const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was",
  "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new",
  "now", "old", "see", "two", "way", "who", "boy", "did", "let", "put", "say", "she",
  "too", "use", "what", "where", "when", "which", "with", "have", "this", "that", "from",
  "they", "will", "your", "need", "does", "into", "about", "should", "would", "could",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s%.-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function uniqueTokens(text: string): string[] {
  return [...new Set(tokenize(text))];
}

export function normalizeQuery(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
