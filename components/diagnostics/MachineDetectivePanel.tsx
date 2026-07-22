"use client";

import { useEffect, useState } from "react";
import { useConversation } from "@/lib/conversation/context";
import { useMachineDetective } from "@/lib/detective/useMachineDetective";
import { useMicroFlash } from "@/lib/ui/micro-interactions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, RotateCcw, HelpCircle, CheckCircle2 } from "lucide-react";

export function MachineDetectivePanel() {
  const { conversation, addArtifact } = useConversation();
  const {
    session,
    snapshot,
    artifact,
    whyExplanation,
    loading,
    error,
    start,
    answer,
    alreadyChecked,
    startOver,
    explainWhy,
  } = useMachineDetective(conversation.id);

  const eliminatedFlash = useMicroFlash("hypothesis_eliminated");
  const confidenceFlash = useMicroFlash("confidence_change");

  const [answerDraft, setAnswerDraft] = useState("");
  const [showWhy, setShowWhy] = useState(false);

  const lastUserMessage = [...conversation.messages]
    .reverse()
    .find((m) => m.role === "user")?.content;

  useEffect(() => {
    if (conversation.mode !== "diagnose") return;
    if (session || !lastUserMessage || loading) return;
    // Vision upload seeds Detective via weldpilot-detective-updated — don't
    // overwrite that session with a fresh start on the placeholder message.
    if (/\[Uploaded weld photo/i.test(lastUserMessage)) return;
    void start(lastUserMessage);
  }, [conversation.mode, session, lastUserMessage, loading, start]);

  useEffect(() => {
    if (artifact) {
      addArtifact(`detective-${conversation.id}`, artifact);
    }
  }, [artifact, addArtifact, conversation.id]);

  if (conversation.mode !== "diagnose") return null;

  const currentQuestion = session?.currentQuestion;

  return (
    <section
      className="shrink-0 border-b border-garage-border bg-garage-panel/80 px-3 py-3 sm:px-4"
      aria-label="Machine Detective"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-garage-orange" aria-hidden />
          <h2 className="text-sm font-semibold text-garage-text">Machine Detective</h2>
          {session && (
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-2xs tabular-nums",
                confidenceFlash && "micro-flash-confidence",
              )}
            >
              {Math.round(session.diagnosticConfidence * 100)}% confidence
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void startOver(lastUserMessage)}
          disabled={loading}
        >
          <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
          Start over
        </Button>
      </div>

      {error && (
        <p
          className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}

      {!session && !loading && (
        <p className="text-sm text-garage-muted">
          Describe your welding problem in chat to begin a structured diagnostic session.
        </p>
      )}

      {session && snapshot && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-2xs text-garage-muted">
            <span>{session.plausibleCauseCount} plausible cause(s) remain</span>
            <span aria-hidden>·</span>
            <span>{session.eliminatedFaultIds.length} ruled out</span>
            {session.originalComplaint && (
              <>
                <span aria-hidden>·</span>
                <span className="max-w-[240px] truncate" title={session.originalComplaint}>
                  Complaint: {session.originalComplaint}
                </span>
              </>
            )}
          </div>

          {snapshot.rankedHypotheses.length > 0 && (
            <div>
              <p className="label-caps mb-1.5">Top hypotheses</p>
              <ul className="space-y-1" role="list">
                {snapshot.rankedHypotheses.slice(0, 4).map((h) => (
                  <li key={h.id} className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-garage-text">{h.label}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-garage-orange">
                      {Math.round(h.score * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.eliminatedFaults.length > 0 && (
            <div className={cn(eliminatedFlash && "micro-flash-active")}>
              <p className="label-caps mb-1.5">Ruled out</p>
              <ul className="flex flex-wrap gap-1" role="list">
                {snapshot.eliminatedFaults.map((f) => (
                  <li key={f.id}>
                    <Badge
                      variant="outline"
                      className="hypothesis-eliminated text-2xs line-through opacity-60"
                    >
                      {f.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentQuestion && (
            <div className="rounded-md border border-garage-border bg-garage-bg p-3">
              <p className="mb-2 text-sm font-medium leading-relaxed text-garage-text">
                {currentQuestion.text}
              </p>
              {snapshot.whyThisQuestion && (
                <p className="mb-2 text-2xs leading-relaxed text-garage-muted">
                  {snapshot.whyThisQuestion}
                </p>
              )}

              <div className="mb-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowWhy(true);
                    void explainWhy();
                  }}
                  disabled={loading}
                >
                  <HelpCircle className="mr-1 h-3 w-3" aria-hidden />
                  Why are you asking this?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void alreadyChecked(currentQuestion.id, "Checked — no issue found")
                  }
                  disabled={loading}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
                  I already checked this
                </Button>
              </div>

              {showWhy && whyExplanation && (
                <p className="mb-2 rounded-md border border-garage-border bg-garage-panel p-2 text-2xs leading-relaxed text-garage-text">
                  {whyExplanation}
                </p>
              )}

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!answerDraft.trim()) return;
                  void answer(currentQuestion.id, answerDraft.trim()).then(() =>
                    setAnswerDraft(""),
                  );
                }}
              >
                <input
                  type="text"
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                  placeholder="Your answer…"
                  className="flex-1 rounded-md border border-garage-border bg-garage-panel px-3 py-2 text-sm text-garage-text transition-colors focus:border-garage-orange/50 focus:outline-none focus:ring-1 focus:ring-garage-orange/30"
                  disabled={loading}
                  aria-label="Answer to diagnostic question"
                />
                <Button type="submit" size="sm" disabled={loading || !answerDraft.trim()}>
                  Answer
                </Button>
              </form>
            </div>
          )}

          {session.finalResolution && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-sm text-emerald-200">
              {session.finalResolution.summary}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
