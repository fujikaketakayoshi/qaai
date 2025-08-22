// import 'dotenv/config';
import cron from 'node-cron';
import {sequelize, Question, Op} from './config.ts';

const wp_url = process.env.WP_URL;
const wp_headers = new Headers();

wp_headers.append("Content-Type", "application/json");
wp_headers.append("Authorization", process.env.WP_AUTH);

const miibo_api = process.env.MIIBO_API;
const miibo_author_name = process.env.MIIBO_AUTHOR_NAME;

// cron.schedule('* * * * *', () => {
// 	// wp_publish();
// 	// miibo_api_wp_comment()
// });


const wp_publish = async () => {
	const q = await Question.findOne({
		where: {
			title: {[Op.ne]: null},
			body: {[Op.ne]: null},
			publishedAt: null
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
	
	const request_options: RequestInit = {
		method: 'POST',
		headers: wp_headers,
		body: raw,
		redirect: "follow"
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
		q.set('updatedAt', new Date());
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
		"api_key": process.env.MIIBO_API_KEY,
		"agent_id": process.env.MIIBO_AGENT_ID,
		"utterance": q.title + 'について' + q.body
	});

	const requestOptions: RequestInit = {
		method: 'POST',
		headers: miibo_headers,
		body: raw,
		redirect: "follow"
	};
	
	const miibo_response = await fetch(miibo_api, requestOptions);
	
	if ( miibo_response.status !== 200 ) {
		q.miiboStatus = miibo_response.status;
		q.set('updatedAt', new Date());
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

	var wp_request_options: RequestInit = {
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
		console.log('[miibo_api_wp_comment] question_id:' + q.id + ' wp_post_id:' + wp_data.post + ' wp_comment_id:' + wp_data.id + ' success.');
	} else {
		q.miiboStatus = miibo_response.status;
		q.set('updatedAt', new Date());
		await q.save();
		console.log('[miibo_api_wp_comment] question_id:' + q.id + ' fail.');
	}
	return false;
};

wp_publish();
miibo_api_wp_comment();