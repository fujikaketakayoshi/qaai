import puppeteer from 'puppeteer';
import {sequelize, Question} from './config.mjs';

const questions_url = 'https://okwave.jp/list/new_question';


const set_qa_urls = async () => {
	const browser = await puppeteer.launch({
		headless: true
	});
	const page = await browser.newPage();
	await page.goto(questions_url);
	const qa_urls = await page.$$eval('.link_qa', list => {
		return list.map(data => data.href);
	});
	
	qa_urls.map((url) => {
	      const question = Question.create({url: url}, {ignoreDuplicates: true});
	});
	
	await browser.close();
};

set_qa_urls();