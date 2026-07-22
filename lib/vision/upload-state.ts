export type WeldPhotoUploadState =
  | "idle"
  | "preview"
  | "analyzing"
  | "success"
  | "error";

export interface WeldPhotoFileState {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  uploadState: WeldPhotoUploadState;
}

export const INITIAL_WELD_PHOTO_STATE: WeldPhotoFileState = {
  file: null,
  previewUrl: null,
  error: null,
  uploadState: "idle",
};

export function transitionOnFileSelected(
  state: WeldPhotoFileState,
  file: File,
  previewUrl: string,
): WeldPhotoFileState {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  return {
    file,
    previewUrl,
    error: null,
    uploadState: "preview",
  };
}

export function transitionOnValidationError(
  state: WeldPhotoFileState,
  error: string,
): WeldPhotoFileState {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  return {
    file: null,
    previewUrl: null,
    error,
    uploadState: "error",
  };
}

export function transitionOnAnalyzeStart(state: WeldPhotoFileState): WeldPhotoFileState {
  return { ...state, uploadState: "analyzing", error: null };
}

export function transitionOnAnalyzeSuccess(state: WeldPhotoFileState): WeldPhotoFileState {
  return { ...state, uploadState: "success", error: null };
}

export function transitionOnAnalyzeError(
  state: WeldPhotoFileState,
  error: string,
): WeldPhotoFileState {
  return { ...state, uploadState: "error", error };
}

export function transitionOnRemove(state: WeldPhotoFileState): WeldPhotoFileState {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  return { ...INITIAL_WELD_PHOTO_STATE };
}

export function transitionOnRetry(state: WeldPhotoFileState): WeldPhotoFileState {
  return { ...state, uploadState: "preview", error: null };
}

export function getUploadStatusLabel(state: WeldPhotoUploadState): string {
  switch (state) {
    case "idle":
      return "Upload a weld photo";
    case "preview":
      return "Ready to analyze";
    case "analyzing":
      return "Analyzing weld photo…";
    case "success":
      return "Analysis complete";
    case "error":
      return "Analysis failed";
  }
}
