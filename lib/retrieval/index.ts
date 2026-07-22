export * from "@/lib/retrieval/types";
export * from "@/lib/retrieval/tokenizer";
export * from "@/lib/retrieval/bm25";
export * from "@/lib/retrieval/dimensions";
export * from "@/lib/retrieval/expand";
export * from "@/lib/retrieval/decompose";
export * from "@/lib/retrieval/citations";
export * from "@/lib/retrieval/corpus";
export * from "@/lib/retrieval/engine";
export * from "@/lib/retrieval/evaluate";

// Backward-compatible search helpers
export {
  searchManual,
  chunkToCitation,
  getDutyCycleTable,
  getSpecifications,
  getPageRenderPath,
} from "@/lib/retrieval/search";
