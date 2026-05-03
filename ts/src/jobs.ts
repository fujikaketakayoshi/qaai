import puppeteer, { Page } from "puppeteer";
import { prisma } from './config.ts';
import { isFiltered } from "./filter.js";

/* =========================
   Browser helper
========================= */
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
			req.resourceType() === 'document' ? req.continue() : req.abort();
		});
		return await fn(page);
	} finally {
		await browser.close();
	}
}

/* =========================
   URL scrape
========================= */
export const scrapeOkwaveUrls = () =>
	withBrowser(async (page) => {
		await page.goto('https://okwave.jp/list/new_question', { waitUntil: 'domcontentloaded' });
		return page.$$eval('.link_qa', list => list.map((a: any) => a.href));
	});

/* =========================
   Save URLs
========================= */
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

/* =========================
   Run job
========================= */
export async function runJob(name: string, scrapeFn: () => Promise<string[]>) {
	try {
		const urls = await scrapeFn();
		const created = await saveUrls(urls);
		console.log(`[${name}] 新規登録件数: ${created.length}`);
	} catch (err) {
		console.error(`[${name}] エラー:`, err);
	}
}

/* =========================
   Detail scrape
========================= */
const scrapeQuestionDetail = (q_id: number, q_url: string) =>
	withBrowser(async (page) => {
		await page.goto(q_url, { waitUntil: 'domcontentloaded' });

		const notFound = await page.$eval('h1', el => el.textContent?.trim());
		if (notFound === 'ページが見つかりません') {
			await prisma.question.update({
				where: { id: q_id },
				data: { notfoundAt: new Date() }
			});
			console.log(`${q_url} not found!`);
			return null;
		}

		const title = await page.$eval('h1.a-title.a-title--lg.a-title--blk', el => el.textContent?.trim());
		const body  = await page.$eval('p.contents', el => el.textContent?.trim());

		return { title, body };
	});

/* =========================
   Set title/body
========================= */
export async function setQaTitleBodyFiltering() {
	const q = await prisma.question.findFirst({
		where: {
			title: null,
			body: null,
            notfoundAt: null
		}
	});

	if (!q || !q.url) return;

	const detail = await scrapeQuestionDetail(q.id, q.url);
	if (!detail) return;

	const filtering = isFiltered(
		detail.title,
		detail.body
	);

	await prisma.question.update({
		where: { id: q.id },
		data: {
			title: detail.title,
			body: detail.body,
			filtering
		}
	});

	console.log(`[setQaTitleBody] id:${q.id} success.`);
}
