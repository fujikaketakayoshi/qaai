import cron from 'node-cron';
import { prisma } from './config.ts';
import { runJob, scrapeOkwaveUrls, setQaTitleBodyFiltering } from './jobs.ts';

// 毎分：詳細取得
cron.schedule('* * * * *', async () => {
	console.log('[cron] setQaTitleBodyFiltering start');
	await setQaTitleBodyFiltering();
});

// 15分に1回：URL収集
cron.schedule('*/15 * * * *', async () => {
	console.log('[cron] runJob start');
	await runJob('OKWAVE', scrapeOkwaveUrls);
});

// プロセス終了時にDB切断
process.on('SIGINT', async () => {
	console.log('SIGINT received. Disconnecting Prisma...');
	await prisma.$disconnect();
	process.exit(0);
});

console.log('cron started');
