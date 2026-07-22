"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/schemas/conversation";
import type { ProgressStepView } from "@/lib/conversation/context";
import { cn } from "@/lib/utils";
import { User, Bot, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressStatus } from "@/components/chat/ProgressStatus";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  progressSteps?: ProgressStepView[];
}

export function MessageList({ messages, isStreaming, progressSteps = [] }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={<Bot className="h-6 w-6" aria-hidden />}
          title="Start a session"
          description="Describe your setup, weld issue, or manual question. Responses include evidence-backed guidance and interactive artifacts."
        />
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isStreaming && lastMessage?.status === "streaming";
  // Fade the progress component out the moment the answer has its first
  // characters — progress and assistant prose are never shown together.
  const answerStarted = Boolean(lastMessage?.content.trim());

  return (
    <div
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-4"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.map((msg, i) => {
        const isThisMessageStreaming = isLastMessageStreaming && i === messages.length - 1;
        const showProgressInsteadOfBubble =
          isThisMessageStreaming && !answerStarted && progressSteps.length > 0;
        return (
          <div key={msg.id}>
            {isThisMessageStreaming && progressSteps.length > 0 && (
              <ProgressStatus steps={progressSteps} visible={!answerStarted} />
            )}
            {!showProgressInsteadOfBubble && <MessageBubble message={msg} index={i} />}
          </div>
        );
      })}
      {isLastMessageStreaming && progressSteps.length === 0 && <StreamingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1"
      aria-label="Assistant is responding"
      role="status"
    >
      <div className="flex gap-1" aria-hidden>
        <span className="stream-dot h-1.5 w-1.5 rounded-full bg-garage-orange" />
        <span className="stream-dot h-1.5 w-1.5 rounded-full bg-garage-orange" />
        <span className="stream-dot h-1.5 w-1.5 rounded-full bg-garage-orange" />
      </div>
      <span className="font-mono text-2xs uppercase tracking-wider text-garage-muted">
        Streaming
      </span>
    </div>
  );
}

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";

  return (
    <div
      className={cn(
        "message-in flex gap-2.5 sm:gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
      style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
          isUser
            ? "border-garage-orange/30 bg-garage-orange/10"
            : isError
              ? "border-red-500/40 bg-red-500/10"
              : "border-garage-border bg-garage-panel",
        )}
        aria-hidden
      >
        {isError ? (
          <AlertCircle className="h-4 w-4 text-red-400" />
        ) : isUser ? (
          <User className="h-4 w-4 text-garage-orange" />
        ) : (
          <Bot className="h-4 w-4 text-garage-steel" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[88%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[85%] sm:px-4 sm:py-3",
          isUser
            ? "border border-garage-orange/20 bg-garage-orange/10 text-garage-text"
            : isError
              ? "border border-red-500/40 bg-red-500/10 text-red-200"
              : "border border-garage-border bg-garage-panel text-garage-text shadow-panel",
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span
              className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-garage-orange align-middle"
              aria-hidden
            />
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <p className="mt-2 border-t border-garage-border/60 pt-2 font-mono text-2xs text-garage-muted">
            {message.citations.length} citation
            {message.citations.length !== 1 ? "s" : ""} — see evidence panel
          </p>
        )}
      </div>
    </div>
  );
}
