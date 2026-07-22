const sessionImages = new Map<
  string,
  { conversationId: string; mimeType: string; base64: string; createdAt: number }
>();

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, entry] of sessionImages) {
    if (now - entry.createdAt > SESSION_TTL_MS) {
      sessionImages.delete(id);
    }
  }
}

export function storeSessionImage(input: {
  imageId: string;
  conversationId: string;
  mimeType: string;
  base64: string;
}): void {
  pruneExpired();
  sessionImages.set(input.imageId, {
    conversationId: input.conversationId,
    mimeType: input.mimeType,
    base64: input.base64,
    createdAt: Date.now(),
  });
}

export function getSessionImage(imageId: string, conversationId: string) {
  pruneExpired();
  const entry = sessionImages.get(imageId);
  if (!entry || entry.conversationId !== conversationId) return null;
  return entry;
}

export function clearConversationImages(conversationId: string): void {
  for (const [id, entry] of sessionImages) {
    if (entry.conversationId === conversationId) {
      sessionImages.delete(id);
    }
  }
}

export function resetSessionImages(): void {
  sessionImages.clear();
}

export function makeImageId(conversationId: string): string {
  return `weld-img-${conversationId}-${Date.now()}`;
}
