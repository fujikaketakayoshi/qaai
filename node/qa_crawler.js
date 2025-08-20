import puppeteer from 'puppeteer';
// import cron from 'node-cron';
import {sequelize, Question, Op} from './config.js';

// cron.schedule('*/15 * * * *', () => {
	// set_qa_urls();
// });

// cron.schedule('* * * * *', () => {
	// set_qa_title_body();
// });

async function withBrowser(fn) {
	const browser = await puppeteer.launch({
		headless: 'new',
		args: ['--disable-gpu']
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
		return page.$$eval('.link_qa', list => list.map(a => a.href));
	});

const scrapeYahooUrls = () =>
	withBrowser(async (page) => {
		await page.goto('https://chiebukuro.yahoo.co.jp/new/', {waitUntil: 'domcontentloaded'});
		return page.$$eval('.SomeSelector', list => list.map(a => a.href));
	});

async function saveUrls(urls) {
	const created = [];
	for (const url of urls) {
		const [q, isCreated] = await Question.findOrCreate({
			where: { url },
		});
		if (isCreated) created.push(q);
	}
    return created;	
}

async function runJob(name, scrapeFn) {
	try {
		const urls = await scrapeFn();
		const created = await saveUrls(urls);
		console.log(`[${name}] 新規登録件数: ${created.length}`);
	} catch (err) {
		console.error(`[${name}] エラー:`, err);
	}
}

runJob('OKWAVE', scrapeOkwaveUrls);



const scrapeQuestionDetail = (q) => 
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
	const q = await Question.findOne({
		where: {
			[Op.and]: { title: null, body: null, notfoundAt: null }
		}
	});

	if (!q) {
		console.log('[setQaTitleBody] no new question.');
		return;
	}

	const detail = await scrapeQuestionDetail(q);
	if (!detail) return;

	const { title, body } = detail;
	if (title && body) {
		q.title = title;
		q.body  = body;
		await q.save();
		console.log(`[setQaTitleBody] id:${q.id} success.`);
	} else {
		q.updatedAt = new Date();
		q.changed('updatedAt', true);
		await q.save();
		console.log(`[setQaTitleBody] id:${q.id} fail.`);
	}
};

setQaTitleBody();

