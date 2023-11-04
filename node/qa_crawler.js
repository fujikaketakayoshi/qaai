import puppeteer from 'puppeteer';
import {Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize({
	database:'qaai',
	username:'fjkk',
	password: null,
	host:'127.0.0.1',
	dialect:'mysql',
	timezone:'+09:00'
});
const Question = sequelize.define('Question', {
	url: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	},
	title: {
		type: DataTypes.TEXT
	},
	body: {
		type: DataTypes.TEXT
	}
});

//await Question.sync({force: true});

//const q = await Question.create({url:'http://localhost/', title:'タイトル', body:'本文です。'});



const questions_url = 'https://okwave.jp/list/new_question';

(async () => {

	const browser = await puppeteer.launch({
		headless: true
	});
	const page = await browser.newPage();
	await page.goto(questions_url);
	const qa_urls = await page.$$eval('.link_qa', list => {
//		list.map(data => Question.create({url:data}));
		return list.map(data => data.href);
	});
	
	qa_urls.map((url) => {
	      const question = Question.create({url: url}, {ignoreDuplicates: true});
	});
	
//	console.log(qa_urls);
	
	await browser.close();
})();
