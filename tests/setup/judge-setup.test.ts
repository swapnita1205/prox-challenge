import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyKnowledgeBundle } from "@/lib/knowledge/bundle";

describe("knowledge bundle (judge setup)", () => {
  it("includes all required generated files and sample assets", () => {
    const status = verifyKnowledgeBundle();
    expect(status.ok, `missing: ${status.missing.join(", ")}`).toBe(true);
    expect(status.pageCount).toBeGreaterThan(40);
    expect(status.assetSamplePresent).toBe(true);
  });

  it("ships package-lock.json for reproducible npm install", () => {
    expect(existsSync(join(process.cwd(), "package-lock.json"))).toBe(true);
  });

  it(".env is gitignored", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env$/m);
  });

  it(".env.example has only ANTHROPIC_API_KEY placeholder", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const lines = example
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    expect(lines).toEqual(["ANTHROPIC_API_KEY=your-api-key-here"]);
  });
});
