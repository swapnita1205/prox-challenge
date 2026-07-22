export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export interface ImageValidationResult {
  ok: true;
  mimeType: AllowedImageMimeType;
  byteLength: number;
}

export interface ImageValidationError {
  ok: false;
  error: string;
}

export function mimeFromFile(file: Pick<File, "type" | "name">): AllowedImageMimeType | null {
  if (ALLOWED_IMAGE_MIME_TYPES.includes(file.type as AllowedImageMimeType)) {
    return file.type as AllowedImageMimeType;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

export function validateImageFile(file: File): ImageValidationResult | ImageValidationError {
  const mimeType = mimeFromFile(file);
  if (!mimeType) {
    return {
      ok: false,
      error: "Unsupported file type. Use JPEG, PNG, or WebP.",
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: "Image file is empty." };
  }
  return { ok: true, mimeType, byteLength: file.size };
}

export function validateBase64Image(
  base64: string,
  mimeType: string,
): ImageValidationResult | ImageValidationError {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as AllowedImageMimeType)) {
    return { ok: false, error: "Unsupported mime type." };
  }
  const raw = base64.replace(/^data:image\/\w+;base64,/, "");
  let byteLength: number;
  try {
    byteLength = Buffer.from(raw, "base64").byteLength;
  } catch {
    return { ok: false, error: "Invalid base64 image data." };
  }
  if (byteLength === 0) {
    return { ok: false, error: "Image data is empty." };
  }
  if (byteLength > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image too large. Maximum is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    };
  }
  return { ok: true, mimeType: mimeType as AllowedImageMimeType, byteLength };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
