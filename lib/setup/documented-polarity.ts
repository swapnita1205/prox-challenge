import type { Citation } from "@/lib/schemas/conversation";
import type { SetupProcess } from "@/lib/setup/schemas";

export interface DocumentedPolarity {
  process: SetupProcess;
  polarityType: "DCEP" | "DCEN";
  groundSocket: "positive" | "negative";
  electrodeSocket: "positive" | "negative";
  groundLabel: string;
  electrodeLabel: string;
  verified: boolean;
  citations: Citation[];
  manualPage: number;
}

/** Documented polarity from owner-manual.pdf — only verified entries are used for confident recommendations. */
export const DOCUMENTED_POLARITY: Record<SetupProcess, DocumentedPolarity> = {
  "mig-solid": {
    process: "mig-solid",
    polarityType: "DCEP",
    groundSocket: "negative",
    electrodeSocket: "positive",
    groundLabel: "Ground Clamp",
    electrodeLabel: "Wire Feed / MIG Gun",
    verified: true,
    manualPage: 14,
    citations: [
      {
        source: "owner-manual.pdf",
        page: 14,
        section: "DCEP Solid Core Setup",
        excerpt:
          "Plug Ground Clamp Cable into Negative (−) Socket. Plug Wire Feed Power Cable into Positive (+) Socket.",
      },
    ],
  },
  flux: {
    process: "flux",
    polarityType: "DCEN",
    groundSocket: "positive",
    electrodeSocket: "negative",
    groundLabel: "Ground Clamp",
    electrodeLabel: "Wire Feed Power Cable",
    verified: true,
    manualPage: 13,
    citations: [
      {
        source: "owner-manual.pdf",
        page: 13,
        section: "DCEN Flux Setup",
        excerpt:
          "Plug Ground Clamp Cable into Positive (+) Socket. Plug Wire Feed Power Cable into Negative (−) Socket.",
      },
    ],
  },
  tig: {
    process: "tig",
    polarityType: "DCEN",
    groundSocket: "positive",
    electrodeSocket: "negative",
    groundLabel: "Ground Clamp",
    electrodeLabel: "TIG Torch",
    verified: false,
    manualPage: 24,
    citations: [
      {
        source: "owner-manual.pdf",
        page: 24,
        section: "TIG Connect Cables",
        excerpt:
          "Plug Ground Clamp Cable into Positive Socket. Plug TIG Torch Cable into Negative Socket.",
      },
    ],
  },
  stick: {
    process: "stick",
    polarityType: "DCEP",
    groundSocket: "negative",
    electrodeSocket: "positive",
    groundLabel: "Ground Clamp",
    electrodeLabel: "Electrode Holder",
    verified: false,
    manualPage: 27,
    citations: [
      {
        source: "owner-manual.pdf",
        page: 27,
        section: "Stick Connect Cables",
        excerpt:
          "Plug Ground Clamp Cable into Negative Socket. Plug Electrode Holder Cable into Positive Socket.",
      },
    ],
  },
};

export function getPolarityForProcess(process: SetupProcess): DocumentedPolarity {
  return DOCUMENTED_POLARITY[process];
}
