import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { KnowledgeGraph } from "@/lib/knowledge/graph";
import { KnowledgeGraphSnapshotSchema } from "@/lib/knowledge/schemas";

export function serializeKnowledgeGraph(graph: KnowledgeGraph) {
  const snapshot = graph.toSnapshot();
  return KnowledgeGraphSnapshotSchema.parse(snapshot);
}

export function writeKnowledgeGraphJson(graph: KnowledgeGraph, outDir?: string): string {
  const dir = outDir ?? join(process.cwd(), "data", "generated");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "knowledge-graph.json");
  const snapshot = serializeKnowledgeGraph(graph);
  writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf-8");
  return path;
}
