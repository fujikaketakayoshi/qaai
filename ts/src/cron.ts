import cron from 'node-cron';
import { prisma } from './config.ts';
import { runJob, scrapeOkwaveUrls, setQaTitleBodyFiltering, runPublishPipeline } from './jobs.ts';

// 15分に1回：URL収集
cron.schedule('*/10 * * * *', async () => {
	console.log('[cron] runJob start');
	await runJob('OKWAVE', scrapeOkwaveUrls);
});

// 毎分：質問のタイトル本文取得
cron.schedule('* * * * *', async () => {
	console.log('[cron] setQaTitleBodyFiltering start');
	await setQaTitleBodyFiltering();
});

// 毎分：要約パイプライン
let running = false;
cron.schedule('* * * * *', async () => {
	if (running) {
		console.log('skip: already running');
		return;
	}

	running = true;

	try {
		await runPublishPipeline();
	} finally {
		running = false;
	}
});

// プロセス終了時にDB切断
process.on('SIGINT', async () => {
	console.log('SIGINT received. Disconnecting Prisma...');
	await prisma.$disconnect();
	process.exit(0);
});

console.log('cron started');
