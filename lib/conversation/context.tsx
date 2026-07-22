"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ArtifactInstance,
  ArtifactSpec,
} from "@/lib/schemas/artifacts";
import type {
  ChatMessage,
  Citation,
  Conversation,
  WeldMode,
} from "@/lib/schemas/conversation";
import { createInitialMachineState } from "@/lib/agent/modes";
import { createId } from "@/lib/utils";
import { clearClientSession, saveClientSession } from "@/lib/detective/persist";
import type { DiagnosticSession } from "@/lib/detective/schemas";
import type { AnalyzeImageContext } from "@/lib/vision/schemas";
import type { GroundingResult } from "@/lib/grounding/schemas";
import type { SetupInputs } from "@/lib/setup/schemas";
import { clearSetupInputs, saveSetupInputs } from "@/lib/setup/persist";
import { validateArtifactSpec } from "@/lib/artifacts/registry";

export interface AnalyzeWeldPhotoInput {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  previewUrl: string;
  context?: AnalyzeImageContext;
  /** Dev-only: force mock vision when true */
  mock?: boolean;
}

export interface AnalyzeWeldPhotoResult {
  imageId: string;
  artifactId: string;
  mock?: boolean;
  detectiveSessionId?: string;
}

export interface ProgressStepView {
  message: string;
  icon: "search" | "found" | "reasoning" | "artifact";
  artifactType?: string;
}

interface ConversationContextValue {
  conversation: Conversation;
  artifacts: Record<string, ArtifactInstance>;
  activeArtifact: ArtifactInstance | null;
  citations: Citation[];
  grounding: GroundingResult | null;
  /** Transient execution-progress steps for the in-flight request (e.g.
   * "Searching the owner manual"). Rendered in a dedicated status
   * component — never part of the assistant message text. Reset per send. */
  progressSteps: ProgressStepView[];
  isStreaming: boolean;
  error: string | null;
  evidenceOpen: boolean;
  setEvidenceOpen: (open: boolean) => void;
  lastFailedPrompt: string | null;
  sendMessage: (content: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  stopStreaming: () => void;
  analyzeWeldPhoto: (input: AnalyzeWeldPhotoInput) => Promise<AnalyzeWeldPhotoResult>;
  addArtifact: (id: string, spec: ArtifactSpec) => void;
  setCitations: (citations: Citation[]) => void;
  clearError: () => void;
  resetConversation: (options?: { setupInputs?: SetupInputs }) => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

export function useConversation() {
  const ctx = useContext(ConversationContext);
  if (!ctx) {
    throw new Error("useConversation must be used within ConversationProvider");
  }
  return ctx;
}

function createConversation(mode: WeldMode): Conversation {
  const now = Date.now();
  return {
    id: createId(),
    mode,
    messages: [],
    machineState: createInitialMachineState(mode),
    activeArtifactId: null,
    createdAt: now,
    updatedAt: now,
  };
}

interface ConversationProviderProps {
  mode: WeldMode;
  children: ReactNode;
  /** Pre-seed setup wizard inputs (demo scenarios) */
  initialSetupInputs?: SetupInputs;
}

export function ConversationProvider({
  mode,
  children,
  initialSetupInputs,
}: ConversationProviderProps) {
  const [conversation, setConversation] = useState(() => {
    const conv = createConversation(mode);
    if (initialSetupInputs) {
      saveSetupInputs(conv.id, initialSetupInputs);
    }
    return conv;
  });
  const [artifacts, setArtifacts] = useState<Record<string, ArtifactInstance>>({});
  const [citations, setCitations] = useState<Citation[]>([]);
  const [grounding, setGrounding] = useState<GroundingResult | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStepView[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const activeArtifact = useMemo(() => {
    const id = conversation.activeArtifactId;
    return id && artifacts[id] ? artifacts[id] : null;
  }, [conversation.activeArtifactId, artifacts]);

  const addArtifact = useCallback((id: string, spec: ArtifactSpec) => {
    const validated = validateArtifactSpec(spec);
    if (!validated) {
      const placeholder: ArtifactSpec = {
        type: "placeholder",
        title: "Artifact could not be shown",
        description:
          "The model returned an artifact that failed schema validation. Retry the question or open the cited manual page from Evidence.",
      };
      const instance: ArtifactInstance = { id, spec: placeholder, createdAt: Date.now() };
      setArtifacts((prev) => ({ ...prev, [id]: instance }));
      setConversation((prev) => ({
        ...prev,
        activeArtifactId: id,
        updatedAt: Date.now(),
      }));
      setError("Artifact failed validation — showing recovery placeholder. You can retry the last question.");
      return;
    }
    const instance: ArtifactInstance = { id, spec: validated, createdAt: Date.now() };
    setArtifacts((prev) => ({ ...prev, [id]: instance }));
    setConversation((prev) => ({
      ...prev,
      activeArtifactId: id,
      updatedAt: Date.now(),
    }));
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const resetConversation = useCallback(
    (options?: { setupInputs?: SetupInputs }) => {
      abortRef.current?.abort();
      abortRef.current = null;
      const prevId = conversationRef.current.id;
      clearClientSession(prevId);
      clearSetupInputs(prevId);
      window.dispatchEvent(new CustomEvent("weldpilot-detective-cleared"));

      const next = createConversation(mode);
      const setup = options?.setupInputs ?? initialSetupInputs;
      if (setup) saveSetupInputs(next.id, setup);

      setConversation(next);
      setArtifacts({});
      setCitations([]);
      setGrounding(null);
      setProgressSteps([]);
      setIsStreaming(false);
      setError(null);
      setEvidenceOpen(false);
      setLastFailedPrompt(null);
    },
    [mode, initialSetupInputs],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: createId(),
        role: "user",
        content,
        timestamp: Date.now(),
        status: "complete",
      };

      const assistantId = createId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        status: "streaming",
      };

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg, assistantMsg],
        updatedAt: Date.now(),
      }));
      setIsStreaming(true);
      setError(null);
      setLastFailedPrompt(null);
      setProgressSteps([]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let sawDone = false;
      const current = conversationRef.current;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: current.id,
            mode: current.mode,
            message: content,
            machineState: current.machineState,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }

        if (!res.body) throw new Error("No response stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload) as {
                type: string;
                delta?: string;
                artifact?: { id: string; spec: ArtifactSpec };
                citations?: Citation[];
                grounding?: GroundingResult;
                machineState?: Conversation["machineState"];
                message?: string;
                messageId?: string;
                icon?: ProgressStepView["icon"];
                artifactType?: string;
              };

              if (event.type === "text_delta" && event.delta) {
                fullText += event.delta;
                setConversation((prev) => ({
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: fullText } : m,
                  ),
                }));
              } else if (event.type === "progress" && event.message && event.icon) {
                // Transient status line — shown in the dedicated progress
                // component only, never appended to the assistant message.
                setProgressSteps((prev) => [
                  ...prev,
                  { message: event.message!, icon: event.icon!, artifactType: event.artifactType },
                ]);
              } else if (event.type === "artifact" && event.artifact) {
                addArtifact(event.artifact.id, event.artifact.spec);
                setConversation((prev) => ({
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === assistantId
                      ? { ...m, artifactId: event.artifact!.id }
                      : m,
                  ),
                }));
              } else if (event.type === "evidence" && event.citations) {
                setCitations(event.citations);
                setEvidenceOpen(true);
                setConversation((prev) => ({
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === assistantId
                      ? { ...m, citations: event.citations }
                      : m,
                  ),
                }));
              } else if (event.type === "grounding" && event.grounding) {
                setGrounding(event.grounding);
                setEvidenceOpen(true);
              } else if (event.type === "state_update" && event.machineState) {
                setConversation((prev) => ({
                  ...prev,
                  machineState: {
                    ...prev.machineState,
                    ...event.machineState,
                  } as Conversation["machineState"],
                  updatedAt: Date.now(),
                }));
              } else if (event.type === "error") {
                throw new Error(event.message ?? "Stream error");
              } else if (event.type === "done") {
                sawDone = true;
                setConversation((prev) => ({
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === assistantId
                      ? { ...m, status: "complete" as const }
                      : m,
                  ),
                }));
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

        if (!sawDone && !controller.signal.aborted) {
          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    status: fullText.trim() ? ("complete" as const) : ("error" as const),
                    content:
                      fullText.trim() ||
                      "Stream ended before the agent finished. Use Retry to ask again.",
                  }
                : m,
            ),
          }));
          if (!fullText.trim()) {
            setLastFailedPrompt(content);
            setError("Streaming interrupted before completion. Retry the last question.");
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    status: "complete" as const,
                    content: m.content.trim()
                      ? `${m.content}\n\n(Stopped.)`
                      : "(Response stopped.)",
                  }
                : m,
            ),
          }));
          return;
        }
        const message = err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        setLastFailedPrompt(content);
        setConversation((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.status === "streaming"
              ? { ...m, content: message, status: "error" as const }
              : m,
          ),
        }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [addArtifact],
  );

  const retryLastMessage = useCallback(async () => {
    const prompt = lastFailedPrompt;
    if (!prompt || isStreaming) return;
    setError(null);
    await sendMessage(prompt);
  }, [lastFailedPrompt, isStreaming, sendMessage]);

  const analyzeWeldPhoto = useCallback(
    async (input: AnalyzeWeldPhotoInput): Promise<AnalyzeWeldPhotoResult> => {
      setIsStreaming(true);
      setError(null);

      const userMsg: ChatMessage = {
        id: createId(),
        role: "user",
        content: "[Uploaded weld photo for visual diagnosis]",
        timestamp: Date.now(),
        status: "complete",
      };

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
        updatedAt: Date.now(),
      }));

      try {
        const res = await fetch("/api/analyze-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationRef.current.id,
            sessionId: conversationRef.current.id,
            imageBase64: input.imageBase64,
            mimeType: input.mimeType,
            context: input.context,
            mock: input.mock,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Analysis failed (${res.status})`);
        }

        const data = (await res.json()) as {
          artifactId: string;
          artifact: ArtifactSpec;
          imageId: string;
          analysis: {
            visualObservations: string[];
            possibleDefectCategories: string[];
            recommendedNextStep: string;
            disclaimer: string;
            confidence: string;
          };
          mock?: boolean;
          detectiveSessionId?: string;
          detectiveSession?: DiagnosticSession;
          detectiveArtifact?: ArtifactSpec;
        };

        addArtifact(data.artifactId, data.artifact);
        const artifactCitations =
          "citations" in data.artifact && Array.isArray(data.artifact.citations)
            ? (data.artifact.citations as Citation[])
            : [];
        if (artifactCitations.length) {
          setCitations(artifactCitations);
          setEvidenceOpen(true);
        }

        const assistantId = createId();
        const summary = [
          `Visual weld analysis (${data.analysis.confidence} confidence)`,
          "",
          ...data.analysis.visualObservations.map((o) => `• ${o}`),
          "",
          `Possible categories: ${data.analysis.possibleDefectCategories.join(", ").replace(/_/g, " ")}`,
          "",
          `Next step: ${data.analysis.recommendedNextStep}`,
          "",
          data.analysis.disclaimer,
          data.mock ? "\n(Mock analysis — configure ANTHROPIC_API_KEY for live vision.)" : "",
        ].join("\n");

        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: summary,
          timestamp: Date.now(),
          status: "complete",
          artifactId: data.artifactId,
          citations: artifactCitations.length ? artifactCitations : undefined,
        };

        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMsg],
          activeArtifactId: data.artifactId,
          updatedAt: Date.now(),
        }));

        if (data.detectiveArtifact) {
          addArtifact(`detective-vision-${conversationRef.current.id}`, data.detectiveArtifact);
        }

        // Prefer session payload from analyze-image (avoids cross-route in-memory Map misses in Next.js).
        if (data.detectiveSession) {
          saveClientSession(conversationRef.current.id, data.detectiveSession);
          window.dispatchEvent(
            new CustomEvent("weldpilot-detective-updated", {
              detail: data.detectiveSession,
            }),
          );
          if (data.detectiveArtifact) {
            addArtifact(`detective-${conversationRef.current.id}`, data.detectiveArtifact);
          }
        } else if (data.detectiveSessionId) {
          try {
            const detectiveRes = await fetch("/api/detective", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "get", sessionId: data.detectiveSessionId }),
            });
            if (detectiveRes.ok) {
              const detectiveData = (await detectiveRes.json()) as {
                session: DiagnosticSession;
                snapshot?: unknown;
                artifact?: ArtifactSpec;
              };
              saveClientSession(conversationRef.current.id, detectiveData.session);
              window.dispatchEvent(
                new CustomEvent("weldpilot-detective-updated", {
                  detail: detectiveData.session,
                }),
              );
              if (detectiveData.artifact) {
                addArtifact(
                  `detective-${conversationRef.current.id}`,
                  detectiveData.artifact,
                );
              }
            } else {
              setError(
                "Visual analysis succeeded, but Machine Detective session sync failed. You can continue in chat or start Detective manually.",
              );
            }
          } catch {
            setError(
              "Visual analysis succeeded, but Machine Detective session sync failed. You can continue in chat or start Detective manually.",
            );
          }
        }

        return {
          imageId: data.imageId,
          artifactId: data.artifactId,
          mock: data.mock,
          detectiveSessionId: data.detectiveSessionId,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Weld photo analysis failed";
        setError(message);
        throw err;
      } finally {
        setIsStreaming(false);
      }
    },
    [addArtifact],
  );

  const value: ConversationContextValue = {
    conversation,
    artifacts,
    activeArtifact,
    citations,
    grounding,
    progressSteps,
    isStreaming,
    error,
    evidenceOpen,
    setEvidenceOpen,
    lastFailedPrompt,
    sendMessage,
    retryLastMessage,
    stopStreaming,
    analyzeWeldPhoto,
    addArtifact,
    setCitations,
    clearError: () => setError(null),
    resetConversation,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
