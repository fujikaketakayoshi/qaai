import { prisma } from "./config.ts";

type LlmResponse = {
  title_summary: string;
  body_summary: string;
};

async function getCurrentModel(): Promise<string> {
  const res = await fetch("http://127.0.0.1:8080/v1/models");
  const json = await res.json();

  return json.data[0].id;
}

async function summarizeByLlm(
  title: string,
  body: string,
  model: string
): Promise<LlmResponse> {
  const res = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model, // 現在サーバに載ってるモデル名
      messages: [
        {
          role: "system",
          content: `
あなたは与えられた質問文を要約するアシスタントです。
出力はJSONのみで返してください。
説明文・Markdown・コードブロックは禁止です。
`
        },
        {
          role: "user",
          content: `
次の質問内容を要約してください。

質問タイトル:
${title}

質問本文:
${body}

出力形式:
{
  "title_summary": "タイトルの要約",
  "body_summary": "本文の要約"
}
`
        }
      ]
    })
  });

  const json = await res.json();
  const content = json.choices[0].message.content;

  console.log("[RAW LLM RESPONSE]");
  console.log(content);

  const match = content.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error(`JSON not found in response: ${content}`);
  }

  return JSON.parse(match[0]);
}

function modelToColumnSuffix(model: string): string {
  return model.replace(/\.gguf$/, "");
}

async function main() {
  const model = await getCurrentModel();
  console.log(`[LLM] using model: ${model}`);

  const suffix = modelToColumnSuffix(model);
  const titleField = `title_summary_${suffix}`;
  const bodyField = `body_summary_${suffix}`;

  while (true) {
    const q = await prisma.question.findFirst({
      where: {
        title: { not: null },
        body: { not: null },
        filtering: false,
        [titleField]: null,
        [bodyField]: null
      },
      orderBy: [
        // {
        //   bodyLength: "desc"
        // },
        {
          id: "asc"
        }
      ]
    });

    if (!q) {
      console.log(`[${model}] 未要約データなし。終了`);
      break;
    }

    console.log(`processing id: ${q.id}`);

    try {
      const result = await summarizeByLlm(
        q.title!,
        q.body!,
        model
      );

      await prisma.question.update({
        where: { id: q.id },
        data: {
          [titleField]: result.title_summary,
          [bodyField]: result.body_summary
        }
      });

      console.log(`summarized: ${q.id}`);
    } catch (err) {
      console.error(`error on id: ${q.id}`, err);

      // 無限ループ防止（失敗したやつをスキップする）
      await prisma.question.update({
        where: { id: q.id },
        data: {
          updatedAt: new Date()
        }
      });
    }
  }
}
main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
