import cron from 'node-cron';
import {sequelize, Question, Op} from './config.mjs';

const wp_url = 'http://localhost/qaai/wp/';

//cron.schedule('*/15 * * * *', () => {
//	set_qa_urls();
//});
//
cron.schedule('* * * * *', () => {
	wp_publish();
});


const wp_publish = async () => {
	const q = await Question.findOne({
		where: {
			[Op.and]: {
				title: {
					[Op.ne]: null
				},
				body: {
					[Op.ne]: null
				},
				publishedAt: null
			}
		}
	});
		
	const my_headers = new Headers();
	my_headers.append("Content-Type", "application/json");
	my_headers.append("Authorization", "Basic Zmprazp2eGRtR0IyYjVMQ3FWQzNDNTBFdGluUGk=");
	
	const raw = JSON.stringify({
		"title": q.title,
		"content": q.body,
		"status": "publish"
	});
	
	const request_options = {
		method: 'POST',
		headers: my_headers,
		body: raw,
		redirect: 'follow'
	};
	
	const response = await fetch(wp_url + '/?rest_route=/wp/v2/posts', request_options);
	const data = await response.json();
	
	if (data.id) {
		q.postId = data.id;
		q.publishedAt = data.date;
		q.save();
		console.log('[wp_publish] id:' + q.id + ' success.');
	} else {
		q.updatedAt = new Date();
		q.changed('updatedAt', true);
		q.save();
		console.log('[wp_publish] id:' + q.id + ' fail.');
	}
};

//wp_publish();