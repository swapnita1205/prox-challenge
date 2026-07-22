import type { PolarityDiagramArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";

type Spec = z.infer<typeof PolarityDiagramArtifactSchema>;

const SOCKETS = {
  negative: { x: 100, label: "−" },
  positive: { x: 300, label: "+" },
} as const;

export function PolarityDiagramArtifact({ spec }: { spec: Spec }) {
  const groundKey =
    spec.groundSocket === "workpiece"
      ? "workpiece"
      : spec.groundSocket === "positive"
        ? "positive"
        : "negative";
  const electrodeKey =
    spec.electrodeSocket === "torch" ? "torch" : spec.electrodeSocket;

  return (
    <ArtifactShell {...spec}>
      <div className="overflow-x-auto">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-garage-panel px-2 py-1 font-mono text-xs uppercase text-garage-text">
            {spec.process.replace("-", " ")}
          </span>
          {spec.polarityType && (
            <span className="font-mono text-xs text-garage-orange">{spec.polarityType}</span>
          )}
        </div>

        <svg
          viewBox="0 0 400 300"
          className="w-full min-w-[280px] max-w-lg rounded-lg border border-garage-border bg-garage-bg"
          role="img"
          aria-label={`Polarity diagram for ${spec.process}`}
        >
          <rect x="20" y="24" width="360" height="72" rx="6" fill="#2a2a2e" stroke="#3a3a40" />
          <text x="200" y="48" textAnchor="middle" fill="#e8e8ea" fontSize="11" fontFamily="monospace">
            OMNIPRO 220 — Front Panel
          </text>

          {(["negative", "positive"] as const).map((key) => (
            <g key={key}>
              <circle
                cx={SOCKETS[key].x}
                cy="78"
                r="16"
                fill="#c9a227"
                stroke="#8b7355"
                strokeWidth="2"
                className="transition-all duration-300"
                opacity={groundKey === key || electrodeKey === key ? 1 : 0.45}
              />
              <text
                x={SOCKETS[key].x}
                y="83"
                textAnchor="middle"
                fill="#1a1a1c"
                fontSize="16"
                fontWeight="bold"
              >
                {SOCKETS[key].label}
              </text>
              <text x={SOCKETS[key].x} y="98" textAnchor="middle" fill="#9a9aa3" fontSize="9">
                {key} socket
              </text>
            </g>
          ))}

          {groundKey !== "workpiece" && (
            <g>
              <path
                d={`M ${SOCKETS[groundKey as keyof typeof SOCKETS].x} 94 L ${SOCKETS[groundKey as keyof typeof SOCKETS].x} 150`}
                stroke="#e85d04"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
              <text x={SOCKETS[groundKey as keyof typeof SOCKETS].x} y="168" textAnchor="middle" fill="#e85d04" fontSize="10">
                {spec.groundLabel}
              </text>
            </g>
          )}

          {electrodeKey !== "torch" && (
            <g>
              <path
                d={`M ${SOCKETS[electrodeKey as keyof typeof SOCKETS].x} 94 L ${SOCKETS[electrodeKey as keyof typeof SOCKETS].x} 200`}
                stroke="#4a9eff"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
              <text x={SOCKETS[electrodeKey as keyof typeof SOCKETS].x} y="218" textAnchor="middle" fill="#4a9eff" fontSize="10">
                {spec.electrodeLabel}
              </text>
            </g>
          )}

          {groundKey === "workpiece" && (
            <g>
              <path d="M 300 94 L 300 190" stroke="#4a9eff" strokeWidth="4" fill="none" />
              <text x="310" y="175" fill="#4a9eff" fontSize="10">
                {spec.electrodeLabel}
              </text>
              <path d="M 100 94 L 100 190" stroke="#e85d04" strokeWidth="4" fill="none" />
              <text x="55" y="175" fill="#e85d04" fontSize="10">
                {spec.groundLabel}
              </text>
              <rect x="130" y="210" width="140" height="36" rx="4" fill="#444" stroke="#666" />
              <text x="200" y="232" textAnchor="middle" fill="#ddd" fontSize="10">
                Workpiece
              </text>
            </g>
          )}

          <text x="200" y="285" textAnchor="middle" fill="#9a9aa3" fontSize="9">
            Twist cables clockwise to lock
          </text>
        </svg>
      </div>
    </ArtifactShell>
  );
}
