import type { Posting } from "./bm25";

export const INDEX_VERSION = 1;

export interface IndexedDoc {
  path: string;
  title: string;
  length: number;
}

export interface SearchIndex {
  version: number;
  built_at: string;
  docs: IndexedDoc[];
  postings: Record<string, Posting[]>;
  avg_length: number;
}

export interface SearchResult {
  path: string;
  abs: string;
  title: string;
  score: number;
  snippet: string;
}
