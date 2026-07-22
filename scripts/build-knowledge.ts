import { buildKnowledgeGraph, writeKnowledgeGraphJson } from "@/lib/knowledge";

const graph = buildKnowledgeGraph();
const path = writeKnowledgeGraphJson(graph);
const stats = graph.getStats();
console.log(`Knowledge graph written to ${path}`);
console.log(`  Nodes: ${stats.nodeCount}`);
console.log(`  Relationships: ${stats.relationshipCount} (${stats.verifiedRelationships} verified)`);
console.log(`  Evidence: ${stats.evidenceCount}`);
