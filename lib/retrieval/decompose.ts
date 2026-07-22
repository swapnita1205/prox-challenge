import type { CorpusType, QueryDimensions, RetrievalTask } from "@/lib/retrieval/types";
import { expandForIntent, expandQuery } from "@/lib/retrieval/expand";

function task(
  id: string,
  intent: string,
  expandedQuery: string,
  corpusTypes?: CorpusType[],
  dimensions?: Partial<QueryDimensions>,
): RetrievalTask {
  return { id, intent, expandedQuery, corpusTypes, dimensions };
}

export function decomposeQuery(query: string, dimensions: QueryDimensions): RetrievalTask[] {
  const tasks: RetrievalTask[] = [];
  const baseExpanded = expandQuery(query, dimensions.processes);
  const processes = dimensions.processes;

  tasks.push(
    task("task-primary", "general", baseExpanded, undefined, dimensions),
  );

  if (dimensions.intents.includes("duty_cycle") || dimensions.outputAmps) {
    tasks.push(
      task(
        "task-duty-cycle",
        "duty_cycle",
        expandForIntent("duty_cycle", query, processes),
        ["duty_cycle", "table", "text_section"],
        { processes, inputVoltage: dimensions.inputVoltage, outputAmps: dimensions.outputAmps },
      ),
    );
  }

  if (dimensions.intents.includes("polarity") || dimensions.polarity || /socket|clamp|cable/i.test(query)) {
    tasks.push(
      task(
        "task-polarity",
        "polarity",
        expandForIntent("polarity", query, processes),
        ["polarity", "figure", "text_section", "graph_relationship"],
        { processes, polarity: dimensions.polarity, component: dimensions.component ?? "ground clamp" },
      ),
    );
  }

  if (dimensions.intents.includes("troubleshooting") || dimensions.symptom) {
    tasks.push(
      task(
        "task-troubleshooting",
        "troubleshooting",
        expandForIntent("troubleshooting", `${query} ${dimensions.symptom ?? ""}`, processes),
        ["troubleshooting", "text_section", "graph_relationship"],
        { processes, symptom: dimensions.symptom },
      ),
    );
  }

  if (dimensions.intents.includes("settings") || dimensions.material || dimensions.thickness) {
    tasks.push(
      task(
        "task-settings",
        "settings",
        expandForIntent("settings", query, processes),
        ["settings", "table", "figure"],
        {
          processes,
          material: dimensions.material,
          thickness: dimensions.thickness,
          wireType: dimensions.wireType,
        },
      ),
    );
  }

  if (dimensions.intents.includes("safety") || dimensions.safetyRelevant) {
    tasks.push(
      task(
        "task-safety",
        "safety",
        expandForIntent("safety", query, processes),
        ["warning", "text_section"],
        { safetyRelevant: true },
      ),
    );
  }

  if (dimensions.intents.includes("visual") || dimensions.component === "front panel") {
    tasks.push(
      task(
        "task-visual",
        "visual",
        expandForIntent("visual", query, processes),
        ["figure", "text_section"],
        { component: dimensions.component },
      ),
    );
  }

  if (dimensions.intents.includes("wire_feed") || dimensions.component === "wire feed") {
    tasks.push(
      task(
        "task-wire-feed",
        "wire_feed",
        expandForIntent("wire_feed", query, processes),
        ["text_section", "troubleshooting", "graph_relationship"],
        { component: "wire feed", processes },
      ),
    );
  }

  if (dimensions.intents.includes("setup") || processes.length > 0) {
    for (const p of processes) {
      tasks.push(
        task(
          `task-setup-${p}`,
          "setup",
          expandForIntent("setup", `${p} setup ${query}`, [p]),
          ["text_section", "polarity", "warning", "figure"],
          { processes: [p] },
        ),
      );
    }
  }

  // Compound example: TIG polarity + ground clamp
  if (processes.includes("tig") && (dimensions.polarity || /ground clamp|work clamp/i.test(query))) {
    tasks.push(
      task(
        "task-tig-ground",
        "tig_ground_clamp",
        "tig torch cable negative socket ground clamp positive socket setup",
        ["text_section", "polarity", "figure"],
        { processes: ["tig"], component: "ground clamp" },
      ),
    );
  }

  const seen = new Set<string>();
  return tasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}
