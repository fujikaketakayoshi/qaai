import puppeteer, { Page } from "puppeteer";
import {prisma} from './config.ts';

type QuestionType = NonNullable<Awaited<ReturnType<typeof prisma.question.findFirst>>>;


async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"]
	});
	const page = await browser.newPage();
	try {
		await page.setDefaultNavigationTimeout(0);
		await page.setRequestInterception(true);
		page.on('request', req => {
			if (req.resourceType() === 'document') {
				req.continue();
			} else { 
				req.abort();
			}
		});
		return await fn(page);
	} finally {
		await browser.close();
	}
}

const scrapeOkwaveUrls = () =>
	withBrowser(async (page) => {
		await page.goto('https://okwave.jp/list/new_question', {waitUntil: 'domcontentloaded'});
		return page.$$eval('.link_qa', list => list.map((a: any) => a.href));
	});

async function saveUrls(urls: string[]) {
	const created = [];
	for (const url of urls) {
		const existing = await prisma.question.findUnique({ where: { url } });
		if (existing) continue;
		const q = await prisma.question.create({ data: { url } });
		created.push(q);
	}
    return created;	
}

async function runJob(name: string, scrapeFn: () => Promise<string[]>) {
	try {
		const urls = await scrapeFn();
		const created = await saveUrls(urls);
		console.log(`[${name}] 新規登録件数: ${created.length}`);
	} catch (err) {
		console.error(`[${name}] エラー:`, err);
	}
}

runJob('OKWAVE', scrapeOkwaveUrls);



const scrapeQuestionDetail = (q: QuestionType) => 
	withBrowser(async (page) => {
    await page.goto(q.url, { waitUntil: 'domcontentloaded' });

    // 404チェック
    const notFound = await page.$eval('h1', el => el.textContent.trim());
    if (notFound === 'ページが見つかりません') {

		q.notfoundAt = new Date();
		q.changed('notfoundAt', true);
		await q.save();
		console.log(`${q.url} not found!`);
		return null;
    }

    // タイトルと本文を取得
    const title = await page.$eval('h1.a-title.a-title--lg.a-title--blk', el => el.textContent.trim());
    const body  = await page.$eval('p.contents', el => el.textContent.trim());

    return { title, body };
});

const setQaTitleBody = async () => {
	const q = await prisma.question.findFirst({
		where: {
			title: { not: null },
			body: { not: null },
			publishedAt: null
		}
	});

	if (!q) {
		console.log('[setQaTitleBody] no new question.');
		return;
	}
    if (!q.url) {
        console.error('URL is empty or null for:', q.id);
        return;
    }

	const detail = await scrapeQuestionDetail(q);
	if (!detail) return;

	const { title, body } = detail;
	if (title && body) {
		const updated = await prisma.question.update({
			where: { id: q.id },
			data: {
				title: title,
				body: body
			}
		});
		console.log(`[setQaTitleBody] id:${q.id} success.`);
	} else {
		const updated = await prisma.question.update({
			where: { id: q.id },
			data: {
				updatedAt: new Date()
			}
		});
		console.log(`[setQaTitleBody] id:${q.id} fail.`);
	}
};

setQaTitleBody();

await prisma.$disconnect();
