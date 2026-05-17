export async function generateAnswerByLlm(
  title: string,
  body: string,
  model: string
): Promise<string> {
  const res = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `
あなたは質問回答アシスタントです。
日本語で自然かつ簡潔に回答してください。
`
        },
        {
          role: "user",
          content: `
以下は要約済みの質問であることを踏まえて回答を作成してください。

質問タイトル:
${title}

質問本文:
${body}

回答を作成してください。
`
        }
      ]
    })
  });

  const json = await res.json();

  return json.choices[0].message.content.trim();
}