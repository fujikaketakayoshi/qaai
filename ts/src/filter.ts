import { FILTER_WORDS } from "./filtering_words.js";

export function isFiltered(
	title: string | null,
	body: string | null
): boolean {
	const text = `${title ?? ""} ${body ?? ""}`.toLowerCase();

	return FILTER_WORDS.some(word =>
		text.includes(word.toLowerCase())
	);
}