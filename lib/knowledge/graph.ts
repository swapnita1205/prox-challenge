import type {
  EntityMap,
  KnowledgeNode,
  KnowledgeRelationship,
  ManualEvidence,
  NodeType,
  Provenance,
  VerificationStatus,
} from "@/lib/knowledge/schemas";

export function toVerificationStatus(
  confidence: number,
  needsReview?: boolean,
): VerificationStatus {
  if (needsReview) return "unverified";
  if (confidence >= 0.75) return "verified";
  return "unverified";
}

export function provenanceToEvidence(
  id: string,
  provenance: Provenance,
  excerpt?: string,
): ManualEvidence {
  return {
    id,
    provenance,
    excerpt: excerpt ?? provenance.neighboringText,
    assetPath: provenance.assetPath,
  };
}

export class KnowledgeGraph {
  private nodes = new Map<string, KnowledgeNode>();
  private relationships: KnowledgeRelationship[] = [];
  private evidence = new Map<string, ManualEvidence>();

  addEvidence(evidence: ManualEvidence): void {
    this.evidence.set(evidence.id, evidence);
  }

  getEvidence(id: string): ManualEvidence | undefined {
    return this.evidence.get(id);
  }

  getAllEvidence(): ManualEvidence[] {
    return Array.from(this.evidence.values());
  }

  addNode<T extends NodeType>(type: T, data: EntityMap[T]): void {
    const node: KnowledgeNode = { id: data.id, type, data: data as unknown as Record<string, unknown> };
    this.nodes.set(data.id, node);
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  getTypedNode<T extends NodeType>(id: string, type: T): EntityMap[T] | undefined {
    const node = this.nodes.get(id);
    if (!node || node.type !== type) return undefined;
    return node.data as EntityMap[T];
  }

  getNodesByType<T extends NodeType>(type: T): EntityMap[T][] {
    return Array.from(this.nodes.values())
      .filter((n) => n.type === type)
      .map((n) => n.data as EntityMap[T]);
  }

  addRelationship(rel: KnowledgeRelationship): void {
    this.relationships.push(rel);
  }

  getRelationships(filter?: {
    type?: KnowledgeRelationship["type"];
    fromId?: string;
    toId?: string;
  }): KnowledgeRelationship[] {
    return this.relationships.filter((r) => {
      if (filter?.type && r.type !== filter.type) return false;
      if (filter?.fromId && r.fromId !== filter.fromId) return false;
      if (filter?.toId && r.toId !== filter.toId) return false;
      return true;
    });
  }

  getOutgoing(id: string, type?: KnowledgeRelationship["type"]): KnowledgeRelationship[] {
    return this.getRelationships({ fromId: id, type });
  }

  getIncoming(id: string, type?: KnowledgeRelationship["type"]): KnowledgeRelationship[] {
    return this.getRelationships({ toId: id, type });
  }

  getNeighbors(id: string, type?: KnowledgeRelationship["type"]): string[] {
    const out = this.getOutgoing(id, type).map((r) => r.toId);
    const inc = this.getIncoming(id, type).map((r) => r.fromId);
    return [...new Set([...out, ...inc])];
  }

  getStats() {
    const verified = this.relationships.filter((r) => r.verificationStatus === "verified").length;
    return {
      nodeCount: this.nodes.size,
      relationshipCount: this.relationships.length,
      verifiedRelationships: verified,
      unverifiedRelationships: this.relationships.length - verified,
      evidenceCount: this.evidence.size,
    };
  }

  toSnapshot(): {
    version: number;
    generatedAt: string;
    nodes: KnowledgeNode[];
    relationships: KnowledgeRelationship[];
    evidence: ManualEvidence[];
    stats: ReturnType<KnowledgeGraph["getStats"]>;
  } {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      nodes: Array.from(this.nodes.values()),
      relationships: [...this.relationships],
      evidence: this.getAllEvidence(),
      stats: this.getStats(),
    };
  }

  static fromSnapshot(snapshot: {
    nodes: KnowledgeNode[];
    relationships: KnowledgeRelationship[];
    evidence: ManualEvidence[];
  }): KnowledgeGraph {
    const g = new KnowledgeGraph();
    for (const e of snapshot.evidence) g.addEvidence(e);
    for (const n of snapshot.nodes) g.nodes.set(n.id, n);
    g.relationships = [...snapshot.relationships];
    return g;
  }
}
