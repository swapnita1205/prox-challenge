"use client";

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { useConversation } from "@/lib/conversation/context";
import { useSessionImages } from "@/lib/vision/session-images-client";
import {
  fileToBase64,
  mimeFromFile,
  validateImageFile,
} from "@/lib/vision/validate";
import {
  INITIAL_WELD_PHOTO_STATE,
  getUploadStatusLabel,
  transitionOnAnalyzeError,
  transitionOnAnalyzeStart,
  transitionOnAnalyzeSuccess,
  transitionOnFileSelected,
  transitionOnRemove,
  transitionOnRetry,
  transitionOnValidationError,
  type WeldPhotoFileState,
} from "@/lib/vision/upload-state";
import { cn } from "@/lib/utils";

export function WeldPhotoUpload() {
  const { conversation, analyzeWeldPhoto, isStreaming } = useConversation();
  const { registerImage } = useSessionImages();
  const [state, setState] = useState<WeldPhotoFileState>(INITIAL_WELD_PHOTO_STATE);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setState((s) => transitionOnValidationError(s, validation.error));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setState((s) => transitionOnFileSelected(s, file, previewUrl));
  }, []);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const analyze = async () => {
    if (!state.file || state.uploadState === "analyzing") return;
    setState((s) => transitionOnAnalyzeStart(s));
    try {
      const mimeType = mimeFromFile(state.file);
      if (!mimeType) throw new Error("Unsupported image type");
      const base64 = await fileToBase64(state.file);
      const result = await analyzeWeldPhoto({
        imageBase64: base64,
        mimeType,
        previewUrl: state.previewUrl!,
        context: {
          process: conversation.machineState.process,
          inputVoltage: conversation.machineState.inputVoltage,
          polarity: conversation.machineState.polarity,
          gas: conversation.machineState.gas,
          material: conversation.machineState.material,
        },
      });
      registerImage(result.imageId, state.previewUrl!, mimeType);
      setState((s) => transitionOnAnalyzeSuccess(s));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setState((s) => transitionOnAnalyzeError(s, msg));
    }
  };

  const remove = () => setState((s) => transitionOnRemove(s));
  const retry = () => {
    setState((s) => transitionOnRetry(s));
    void analyze();
  };

  const busy = isStreaming || state.uploadState === "analyzing";

  return (
    <div className="shrink-0 border-t border-garage-border bg-garage-panel/60 px-3 py-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="label-caps">Weld photo</p>
        <span className="font-mono text-2xs text-garage-muted">
          {getUploadStatusLabel(state.uploadState)}
        </span>
      </div>

      {state.uploadState === "idle" && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 transition-all duration-200",
            dragOver
              ? "border-garage-orange bg-garage-orange/5"
              : "border-garage-border bg-garage-bg/50 hover:border-garage-orange/40 hover:bg-garage-bg",
          )}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload weld photo by drag and drop or browse"
        >
          <Upload className="mb-2 h-7 w-7 text-garage-muted" aria-hidden />
          <p className="text-sm font-medium text-garage-text">Drag & drop a weld photo</p>
          <p className="mt-1 font-mono text-2xs text-garage-muted">
            JPEG, PNG, or WebP · max 8 MB
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <ImagePlus className="mr-1 h-3 w-3" aria-hidden />
              Browse
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
            >
              <Camera className="mr-1 h-3 w-3" aria-hidden />
              Camera
            </Button>
          </div>
        </div>
      )}

      {(state.uploadState === "preview" ||
        state.uploadState === "analyzing" ||
        state.uploadState === "success" ||
        state.uploadState === "error") &&
        state.previewUrl && (
          <div className="space-y-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-md border border-garage-border bg-garage-bg">
              <Image
                src={state.previewUrl}
                alt="Weld photo preview"
                fill
                className="object-contain"
                unoptimized
              />
              {state.uploadState === "analyzing" && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55"
                  role="status"
                  aria-label="Analyzing weld photo"
                >
                  <Loader2 className="h-7 w-7 animate-spin text-garage-orange" />
                  <span className="font-mono text-2xs uppercase tracking-wider text-garage-muted">
                    Analyzing
                  </span>
                </div>
              )}
            </div>

            {state.error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200" role="alert">
                {state.error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {state.uploadState !== "success" && (
                <Button type="button" size="sm" onClick={() => void analyze()} disabled={busy}>
                  {state.uploadState === "analyzing" ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
                      Analyzing…
                    </>
                  ) : (
                    "Analyze photo"
                  )}
                </Button>
              )}
              {state.uploadState === "error" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void retry()}
                  disabled={busy}
                >
                  <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
                  Retry
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy}>
                <Trash2 className="mr-1 h-3 w-3" aria-hidden />
                Remove
              </Button>
            </div>

            {state.uploadState === "success" && (
              <p className="text-2xs leading-relaxed text-garage-success">
                Results are in the artifact panel. Visual diagnosis alone may be insufficient —
                use Machine Detective for setup checks.
              </p>
            )}
          </div>
        )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onFileChange}
        aria-hidden
        tabIndex={-1}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={onFileChange}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
