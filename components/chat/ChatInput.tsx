"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";
import { useConversation } from "@/lib/conversation/context";
import { WeldPhotoUpload } from "@/components/vision/WeldPhotoUpload";

export function ChatInput() {
  const { sendMessage, isStreaming, conversation, stopStreaming } = useConversation();
  const [input, setInput] = useState("");

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    await sendMessage(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <>
      {conversation.mode === "diagnose" && <WeldPhotoUpload />}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="shrink-0 border-t border-garage-border bg-garage-panel/90 p-3 sm:p-4"
        aria-label="Send message"
      >
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your setup, weld issue, or question…"
            disabled={isStreaming}
            rows={2}
            aria-label="Message input"
            className="min-h-[52px] resize-none border-garage-border bg-garage-bg text-sm"
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Stop response"
              className="shrink-0 self-end"
              onClick={stopStreaming}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              size="icon"
              aria-label="Send message"
              className="shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 font-mono text-2xs text-garage-muted">
          <kbd className="rounded border border-garage-border bg-garage-bg px-1 py-0.5">
            Enter
          </kbd>{" "}
          send ·{" "}
          <kbd className="rounded border border-garage-border bg-garage-bg px-1 py-0.5">
            Shift+Enter
          </kbd>{" "}
          new line
          {conversation.mode === "diagnose" && " · photo upload above"}
          {isStreaming && " · Stop cancels the in-flight request"}
        </p>
      </form>
    </>
  );
}
