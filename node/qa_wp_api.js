import cron from 'node-cron';
import {sequelize, Question, Op} from './config.mjs';

const wp_url = 'http://localhost/qaai/wp/';
const wp_headers = new Headers();
wp_headers.append("Content-Type", "application/json");
wp_headers.append("Authorization", "Basic Zmprazp2eGRtR0IyYjVMQ3FWQzNDNTBFdGluUGk=");


const miibo_api = 'https://api-mebo.dev/api';
const miibo_author_name = 'miibo [GPT-3.5]';


//cron.schedule('*/15 * * * *', () => {
//	set_qa_urls();
//});
cron.schedule('* * * * *', () => {
//	wp_publish();
	miibo_api_wp_comment()
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
	
	if ( !q ) {
		console.log('[wp_publish] new question not found');
		return false;
	}
		
	const raw = JSON.stringify({
		"title": q.title,
		"content": q.body,
		"status": "publish"
	});
	
	const request_options = {
		method: 'POST',
		headers: wp_headers,
		body: raw,
		redirect: 'follow'
	};
	
	const response = await fetch(wp_url + '/?rest_route=/wp/v2/posts', request_options);
	if (!response.ok) {
		console.error('[wp_publish] fetch failed:', response.status);
		return false;
	}
	const data = await response.json();
	
	if (data?.id) {
		q.postId = data.id;
		q.publishedAt = data.date;
		await q.save();
		console.log('[wp_publish] id:' + q.id + ' success.');
	} else {
		q.updatedAt = new Date();
		q.changed('updatedAt', true);
		await q.save();
		console.log('[wp_publish] id:' + q.id + ' fail.');
	}
	return false;
};


const miibo_api_wp_comment = async () => {
	const q = await Question.findOne({
		where: {
			[Op.and]: {
				title: {
					[Op.ne]: null
				},
				body: {
					[Op.ne]: null
				},
				publishedAt: {
					[Op.ne]: null
				},
				miiboStatus: null
			}
		}
	});
	
	if ( !q ) {
		console.log('[miibo_api_wp_comment] published question not found');
		return false;
	}
	
	const miibo_headers = new Headers();
	miibo_headers.append("Content-Type", "application/json");

	const raw = JSON.stringify({
		"api_key": "c0e5a26a-de4f-4c7d-a86f-1406436b90d918be18d6210211",
		"agent_id": "6e0a7d96-04b7-46cf-92ef-2a185608532b18be18c985b368",
		"utterance": q.title + 'について' + q.body
	});

	const requestOptions = {
		method: 'POST',
		headers: miibo_headers,
		body: raw,
		redirect: 'follow'
	};
	
	const miibo_response = await fetch(miibo_api, requestOptions);
	
	if ( miibo_response.status !== 200 ) {
		q.miiboStatus = miibo_response.status;
		q.updatedAt = new Date();
		q.changed('updatedAt', true);
		await q.save();
		console.log('[miibo_api_wp_comment] id:' + q.id + ' response not 200.');
		return false;
	}
	const miibo_data = await miibo_response.json();
		
	if ( ! miibo_data?.bestResponse?.utterance ) {
		console.log('[miibo_api_wp_comment] miibo api error');
		return false;
	}
	
		
	const wp_raw = JSON.stringify({
		"post": q.postId,
		"author_name": miibo_author_name,
		"content": miibo_data.bestResponse.utterance,
		"status": "approved"
	});

	var wp_request_options = {
		method: 'POST',
		headers: wp_headers,
		body: wp_raw,
		redirect: 'follow'
	};

	const wp_response = await fetch(wp_url + '/?rest_route=/wp/v2/comments', wp_request_options);
	const wp_data = await wp_response.json();
	
	if ( wp_data?.id ) {
		q.miiboStatus = miibo_response.status;
		q.miiboCommentedAt = wp_data.date;
		await q.save();
		console.log('[miibo_api_wp_comment] id:' + q.id + ' success.');
	} else {
		q.miiboStatus = miibo_response.status;
		q.updatedAt = new Date();
		q.changed('updatedAt', true);
		await q.save();
		console.log('[miibo_api_wp_comment] id:' + q.id + ' fail.');
	}
	return false;
};
//wp_publish();
//miibo_api_wp_comment();