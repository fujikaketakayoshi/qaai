import puppeteer from 'puppeteer';
import cron from 'node-cron';
import {sequelize, Question, Op} from './config.mjs';

const questions_url = 'https://okwave.jp/list/new_question';

cron.schedule('*/15 * * * *', () => {
	set_qa_urls();
});

cron.schedule('* * * * *', () => {
	set_qa_title_body();
});


const set_qa_urls = async () => {
	const browser = await puppeteer.launch({
		headless: 'new',
		args: ['--disable-gpu']
	});
	const page = await browser.newPage();
	await page.setDefaultNavigationTimeout(0);
	await page.setRequestInterception(true);
    page.on('request', request => {
        const requestType = request.resourceType();
        if(requestType === 'document') {  // 文書ファイルのみOK
            request.continue(); // 続けて読み込む
        } else {
            request.abort();  // 外部ファイルは読み込まない
        }
    });
	await page.goto(questions_url);
	const qa_urls = await page.$$eval('.link_qa', list => {
		return list.map(data => data.href);
	});
	await browser.close();
	
	let created_ids = await Promise.all( qa_urls.map(async (url) => {
		const q = await Question.create({url: url}, {ignoreDuplicates: true});
		return q.id;
	}));
	created_ids = created_ids.filter( id => id !== undefined );
	console.log('[set_qa_urls] set_url:' + created_ids.length);
};

const set_qa_title_body = async () => {
	const q = await Question.findOne({
		where: {
			[Op.and]: {
				title: null,
				body: null,
				notfoundAt: null
			 }
		}
	});
	
	if ( !q ) {
		console.log('[set_qa_title_body] no new question.');
		return false;
	}
	
	const browser = await puppeteer.launch({
		headless: 'new',
		args: ['--disable-gpu']
	});
	const page = await browser.newPage();
	await page.setDefaultNavigationTimeout(0);
	await page.setRequestInterception(true);
    page.on('request', request => {
        const requestType = request.resourceType();
        if(requestType === 'document') {  // 文書ファイルのみOK
            request.continue(); // 続けて読み込む
        } else {
            request.abort();  // 外部ファイルは読み込まない
        }
    });
    
	await page.goto(q.url);
	
	let el = await page.$('h1');
	const h1_404 = await (await el.getProperty('textContent')).jsonValue();
	if (h1_404 == 'ページが見つかりません') {
		q.notfoundAt = new Date();
		q.changed('notfoundAt', true);
		q.save();
		console.log(q.url + ' not found!');
		return false;
	}
	
	el = await page.$('h1.title.lg.blk.xl_large');
	const title = await (await el.getProperty('textContent')).jsonValue();
	el = await page.$('p.contents');
	const body = await (await el.getProperty('textContent')).jsonValue();
	
	await browser.close();
	
	if (title && body) {
		q.title = title.trim();
		q.body = body.trim();
		q.save();
		console.log('[set_qa_title_body] id:' + q.id + ' success.');
	} else {
		q.updatedAt = new Date();
		q.changed('updatedAt', true);
		q.save();
		console.log('[set_qa_title_body] id:' + q.id + ' fail.');
	}
};


//set_qa_urls();
//set_qa_title_body();