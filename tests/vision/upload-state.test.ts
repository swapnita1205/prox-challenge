import { describe, expect, it } from "vitest";
import {
  INITIAL_WELD_PHOTO_STATE,
  getUploadStatusLabel,
  transitionOnAnalyzeError,
  transitionOnAnalyzeStart,
  transitionOnAnalyzeSuccess,
  transitionOnRemove,
  transitionOnRetry,
  transitionOnValidationError,
} from "@/lib/vision/upload-state";

describe("weld photo upload UI state", () => {
  it("starts idle", () => {
    expect(INITIAL_WELD_PHOTO_STATE.uploadState).toBe("idle");
    expect(getUploadStatusLabel("idle")).toMatch(/upload/i);
  });

  it("moves to analyzing then success", () => {
    const preview = {
      ...INITIAL_WELD_PHOTO_STATE,
      uploadState: "preview" as const,
      previewUrl: "blob:preview",
    };
    const analyzing = transitionOnAnalyzeStart(preview);
    expect(analyzing.uploadState).toBe("analyzing");
    const success = transitionOnAnalyzeSuccess(analyzing);
    expect(success.uploadState).toBe("success");
    expect(getUploadStatusLabel("success")).toMatch(/complete/i);
  });

  it("handles validation and analysis errors", () => {
    const err = transitionOnValidationError(INITIAL_WELD_PHOTO_STATE, "Too large");
    expect(err.uploadState).toBe("error");
    expect(err.error).toBe("Too large");

    const preview = { ...INITIAL_WELD_PHOTO_STATE, uploadState: "preview" as const };
    const fail = transitionOnAnalyzeError(preview, "API down");
    expect(fail.uploadState).toBe("error");
    expect(fail.error).toBe("API down");
  });

  it("retry returns to preview from error", () => {
    const errorState = {
      ...INITIAL_WELD_PHOTO_STATE,
      uploadState: "error" as const,
      error: "fail",
      previewUrl: "blob:x",
    };
    const retried = transitionOnRetry(errorState);
    expect(retried.uploadState).toBe("preview");
    expect(retried.error).toBeNull();
  });

  it("remove resets to initial", () => {
    const cleared = transitionOnRemove({
      ...INITIAL_WELD_PHOTO_STATE,
      uploadState: "success",
      previewUrl: "blob:done",
    });
    expect(cleared).toEqual(INITIAL_WELD_PHOTO_STATE);
  });
});
