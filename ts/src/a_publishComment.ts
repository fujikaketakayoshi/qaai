import { wpHeaders, wpUrl } from "./wp.ts";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
	'qwen3_8b.gguf': "Qwen3-8B",
	'phi4_14b.gguf': "Phi-4-14B",
	'llama3_1_8b.gguf': "Llama-3.1-8B",
};

function modelName(model: string): string {
	return MODEL_DISPLAY_NAMES[model] ?? model;
}

export async function publishCommentToWordPress(
	postId: number,
	content: string,
    model: string
) {
	const res = await fetch(
        `${wpUrl}/wp-json/wp/v2/comments`,
        {
            method: "POST",
            headers: wpHeaders,
			body: JSON.stringify({
				post: postId,
				content: content,
                author_name: modelName(model)
			}),
		}
	);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(
			`WordPress comment post failed: ${res.status} ${text}`
		);
	}

	return await res.json();
}
