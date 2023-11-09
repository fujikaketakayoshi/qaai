import puppeteer from 'puppeteer';
import cron from 'node-cron';
import {sequelize, Question, Op} from './config.mjs';

const questions_url = 'https://okwave.jp/list/new_question';

cron.schedule('*/15 * * * *', () => {
  console.log('set_qa_urls: ' + set_qa_urls());
});

cron.schedule('* * * * *', () => {
  console.log('set_qa_title_body: ' + set_qa_title_body());
});


const set_qa_urls = async () => {
	const browser = await puppeteer.launch({
		headless: true
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
	
	qa_urls.map((url) => {
	      const question = Question.create({url: url}, {ignoreDuplicates: true});
	});
	return qa_urls.count();
};

const set_qa_title_body = async () => {
	const q = await Question.findOne({
		where: {
			[Op.and]: {
				title: null,
				body: null
			 }
		}
	});
	
	if ( !q ) return false;
	
	const browser = await puppeteer.launch({
		headless: true
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
	
	let el = await page.$('h1.title.lg.blk.xl_large');
	const title = await (await el.getProperty('textContent')).jsonValue()
	
	el = await page.$('p.contents');
	const body = await (await el.getProperty('textContent')).jsonValue()
	
	await browser.close();
	
	if (title && body) {
		q.title = title.trim();
		q.body = body.trim();
		q.save();
		return true;
	} else {
		q.updatedAt = new Date();
		q.changed('updatedAt', true);
		q.save();
		return false;
	}
};


//set_qa_urls();
//set_qa_title_body();