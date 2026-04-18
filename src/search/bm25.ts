// Params per Robertson & Zaragoza (2009): k1 in [1.2, 2.0], b = 0.75.
const K1 = 1.2;
const B = 0.75;
const MIN_TOKEN_LENGTH = 3;

const TOKEN_SPLIT = /[^a-z0-9]+/;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

export interface Posting {
  doc: number;
  tf: number;
}

export function scoreBM25(
  postings: Posting[],
  queryFreq: number,
  docs: { length: number }[],
  avgDocLength: number,
): Map<number, number> {
  const scores = new Map<number, number>();
  if (postings.length === 0 || queryFreq === 0) return scores;

  const n = docs.length;
  const df = postings.length;
  const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));

  for (const { doc, tf } of postings) {
    const docLen = docs[doc].length || 1;
    const norm = 1 - B + (B * docLen) / avgDocLength;
    const tfComponent = (tf * (K1 + 1)) / (tf + K1 * norm);
    scores.set(doc, (scores.get(doc) ?? 0) + idf * tfComponent * queryFreq);
  }

  return scores;
}
