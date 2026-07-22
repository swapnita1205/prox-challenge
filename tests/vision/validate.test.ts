import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BYTES,
  mimeFromFile,
  validateBase64Image,
  validateImageFile,
} from "@/lib/vision/validate";

function makeFile(name: string, type: string, size: number): File {
  const buffer = new Uint8Array(size);
  return new File([buffer], name, { type });
}

describe("vision validate", () => {
  it("accepts jpeg png webp by mime", () => {
    expect(mimeFromFile({ name: "w.jpg", type: "image/jpeg" })).toBe("image/jpeg");
    expect(mimeFromFile({ name: "w.png", type: "image/png" })).toBe("image/png");
    expect(mimeFromFile({ name: "w.webp", type: "image/webp" })).toBe("image/webp");
  });

  it("infers mime from extension when type missing", () => {
    expect(mimeFromFile({ name: "weld.JPG", type: "" })).toBe("image/jpeg");
  });

  it("rejects unsupported types", () => {
    const result = validateImageFile(makeFile("x.gif", "image/gif", 100));
    expect(result.ok).toBe(false);
  });

  it("rejects oversize files", () => {
    const result = validateImageFile(
      makeFile("big.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/i);
  });

  it("validates base64 payload size", () => {
    const tiny = Buffer.from("abc").toString("base64");
    const ok = validateBase64Image(tiny, "image/png");
    expect(ok.ok).toBe(true);

    const huge = Buffer.alloc(MAX_IMAGE_BYTES + 1).toString("base64");
    const bad = validateBase64Image(huge, "image/png");
    expect(bad.ok).toBe(false);
  });
});
