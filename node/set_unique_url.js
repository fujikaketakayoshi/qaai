import {sequelize, Question, Op} from './config.mjs';
	
const url = 'https://okwave.jp/qa/q10197212.html';

(async() => {
	const question = await Question.create({url: url}, {ignoreDuplicates: true});
	console.log(question.isNewRecord);
})();

