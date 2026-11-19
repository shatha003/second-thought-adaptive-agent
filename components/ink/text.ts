/** End a sentence with a full stop unless it already has terminal punctuation. */
export const sentence = (t: string) => (/[.!?:”"]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
