import puppeteer, { Page } from "puppeteer";
import { prisma } from './config.ts';
import { isFiltered } from "./filter.js";
import { summarizeOneQuestion } from "./q_summarize.ts";
import { generateAnswerByLlm } from "./a_generate.ts";
import { publishCommentToWordPress } from "./a_publishComment.ts";
import { wpHeaders, wpUrl } from "./wp.ts";

/* =========================
   Browser helper
========================= */
async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"]
	});
	const page = await browser.newPage();
	try {
		await page.setDefaultNavigationTimeout(0);
		await page.setRequestInterception(true);
		page.on('request', req => {
			req.resourceType() === 'document' ? req.continue() : req.abort();
		});
		return await fn(page);
	} finally {
		await browser.close();
	}
}

/* =========================
   URL scrape
========================= */
export const scrapeOkwaveUrls = () =>
	withBrowser(async (page) => {
		await page.goto('https://okwave.jp/list/new_question', { waitUntil: 'domcontentloaded' });
		return page.$$eval('.link_qa', list => list.map((a: any) => a.href));
	});

/* =========================
   Save URLs
========================= */
async function saveUrls(urls: string[]) {
	const created = [];
	for (const url of urls) {
		const existing = await prisma.question.findUnique({ where: { url } });
		if (existing) continue;
		const q = await prisma.question.create({ data: { url } });
		created.push(q);
	}
	return created;
}

/* =========================
   Run job
========================= */
export async function runJob(name: string, scrapeFn: () => Promise<string[]>) {
	try {
		const urls = await scrapeFn();
		const created = await saveUrls(urls);
		console.log(`[${name}] 新規登録件数: ${created.length}`);
	} catch (err) {
		console.error(`[${name}] エラー:`, err);
	}
}

/* =========================
   Detail scrape
========================= */
const scrapeQuestionDetail = (q_id: number, q_url: string) =>
	withBrowser(async (page) => {
		await page.goto(q_url, { waitUntil: 'domcontentloaded' });

		const notFound = await page.$eval('h1', el => el.textContent?.trim());
		if (notFound === 'ページが見つかりません') {
			await prisma.question.update({
				where: { id: q_id },
				data: { notfoundAt: new Date() }
			});
			console.log(`${q_url} not found!`);
			return null;
		}

		const title = await page.$eval('h1.a-title.a-title--lg.a-title--blk', el => el.textContent?.trim());
		const body  = await page.$eval('p.contents', el => el.textContent?.trim());

		return { title, body };
	});

/* =========================
   Set title/body
========================= */
export async function setQaTitleBodyFiltering() {
	const q = await prisma.question.findFirst({
		where: {
			title: null,
			body: null,
            notfoundAt: null
		}
	});

	if (!q || !q.url) return;

	const detail = await scrapeQuestionDetail(q.id, q.url);
	if (!detail) return;

	const filtering = isFiltered(
		detail.title,
		detail.body
	);

	await prisma.question.update({
		where: { id: q.id },
		data: {
			title: detail.title,
			body: detail.body,
			filtering
		}
	});

	console.log(`[setQaTitleBody] id:${q.id} success.`);
}


async function getCurrentModel(): Promise<string> {
  const res = await fetch("http://127.0.0.1:8080/v1/models");
  const json = await res.json();

  return json.data[0].id;
}

function isQwenModel(model: string): boolean {
	return model.toLowerCase().includes("qwen");
}

function modelToColumnSuffix(model: string): string {
  return model.replace(/\.gguf$/, "");
}

export async function publishQuestionSummary(model: string) {
  const suffix = modelToColumnSuffix(model);

  const titleField = `title_summary_${suffix}`;
  const bodyField = `body_summary_${suffix}`;

  const q = await prisma.question.findFirst({
    where: {
      filtering: false,

      [titleField]: {
        not: null
      },

      [bodyField]: {
        not: null
      },

      publishedAt: null
    },
    orderBy: {
      id: "asc"
    }
  });

  if (!q) {
    console.log("[publishQuestionSummary] no target");
    return;
  }

  const title = q[
    titleField as keyof typeof q
  ] as string;

  const body = q[
    bodyField as keyof typeof q
  ] as string;

  const raw = JSON.stringify({
    title,
    content: body,
    status: "publish",
	comment_status: "open",
  });

  const response = await fetch(
    `${wpUrl}/?rest_route=/wp/v2/posts`,
    {
      method: "POST",
      headers: wpHeaders,
      body: raw
    }
  );

  if (!response.ok) {
    console.error(
      "[publishQuestionSummary] fetch failed:",
      response.status
    );

    return;
  }

  const data = await response.json();

  if (data?.id) {
    await prisma.question.update({
      where: {
        id: q.id
      },
      data: {
        postId: data.id,
        publishedAt: new Date(data.date)
      }
    });

	console.log(
      `[publishQuestionSummary] question_id:${q.id} wp_post_id:${data.id} success`
	);
  } else {
    console.log(
      `[publishQuestionSummary] id:${q.id} fail`
    );
  }
}

async function publishAnswerArticle(model: string) {
	console.log("[pipeline] publishAnswerArticle");

	// 1. 未回答Question取得（同一modelのAnswerが無いもの）
	const question = await prisma.question.findFirst({
		where: {
			postId: {
				not: null,
			},
			publishedAt: {
				not: null,
			},
			answers: {
				none: {
					llmModel: model,
				},
			},
		},
		orderBy: {
			id: "asc",
		},
	});
	if (!question) {
		console.log("[pipeline] no unanswered question");
		return;
	}

	// 3. 要約済みQからAnswer生成
	const titleSummary = question.title_summary_qwen3_8b;
	const bodySummary = question.body_summary_qwen3_8b;

	const answerBody = await generateAnswerByLlm(
		titleSummary ?? "",
		bodySummary ?? "",
		model
	);
	console.log("[ANSWER]" + answerBody);
	// 4. Answers作成
	const answer = await prisma.answer.create({
		data: {
			qId: question.id,
			llmModel: model,
			body: answerBody,
		},
	});
	console.log(`[pipeline] answer created id=${answer.id}`);

	// 5. WordPressコメント投稿
	const wpComment = await publishCommentToWordPress(
		question.postId!,
		answerBody,
		model
	);
	console.log(`[pipeline] wp comment published id=${wpComment.id}`);

	// 6. wpCommentId/publishedAt更新
	await prisma.answer.update({
		where: {
			id: answer.id,
		},
		data: {
			wpCommentId: wpComment.id,
			publishedAt: new Date(),
		},
	});

}

export async function runPublishPipeline() {
	console.log("[pipeline] start");

	try {
		const model = await getCurrentModel();

		console.log(`[pipeline] model=${model}`);

		if (isQwenModel(model)) {
			console.log("[pipeline] qwen mode");
			await summarizeOneQuestion(model);
			await publishQuestionSummary(model);
			await publishAnswerArticle(model);
		} else {
			console.log("[pipeline] answer-only mode");
			await publishAnswerArticle(model);
		}

		console.log("[pipeline] done");
	} catch (err) {
		console.error("[pipeline] error:", err);
	}
}