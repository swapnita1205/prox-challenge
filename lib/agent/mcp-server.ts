import { z } from "zod";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import type { AgentContext } from "@/lib/agent/context";
import {
  handleCalculateDutyCycle,
  handleFindSettings,
  handleGenerateArtifactSpec,
  handleGetFigure,
  handleGetManualPage,
  handleQueryMachineGraph,
  handleRunSafetyReview,
  handleSearchManual,
  handleStartDiagnosticSession,
  handleUpdateDiagnosticSession,
  handleValidateMachineConfiguration,
} from "@/lib/agent/tools/handlers";

export const WELDPILOT_MCP_SERVER_NAME = "weldpilot";

export const WELDPILOT_TOOL_NAMES = [
  "search_manual",
  "get_manual_page",
  "get_figure",
  "query_machine_graph",
  "calculate_duty_cycle",
  "validate_machine_configuration",
  "find_settings",
  "start_diagnostic_session",
  "update_diagnostic_session",
  "generate_artifact_spec",
  "run_safety_review",
] as const;

export function weldpilotAllowedTools(): string[] {
  return WELDPILOT_TOOL_NAMES.map((name) => `mcp__${WELDPILOT_MCP_SERVER_NAME}__${name}`);
}

export function createWeldPilotMcpServer(ctx: AgentContext) {
  return createSdkMcpServer({
    name: WELDPILOT_MCP_SERVER_NAME,
    version: "1.0.0",
    alwaysLoad: true,
    tools: [
      tool(
        "search_manual",
        "Hybrid retrieval across manual sections, tables, figures, warnings, troubleshooting, polarity, settings, duty cycle, and graph relationships.",
        { query: z.string(), limit: z.number().optional() },
        async (args) => handleSearchManual(ctx, args),
      ),
      tool(
        "get_manual_page",
        "Fetch full text and page render asset for a manual page.",
        { source: z.string(), page: z.number() },
        async (args) => handleGetManualPage(ctx, args),
      ),
      tool(
        "get_figure",
        "Fetch a manual figure/diagram by assetId or source+page.",
        {
          assetId: z.string().optional(),
          source: z.string().optional(),
          page: z.number().optional(),
        },
        async (args) => handleGetFigure(ctx, args),
      ),
      tool(
        "query_machine_graph",
        "Query the verified machine knowledge graph for setup, faults, or safety prerequisites.",
        {
          queryType: z.enum(["required_setup", "faults_for_symptom", "safety_prerequisites"]),
          processId: z.string().optional(),
          symptom: z.string().optional(),
          actionId: z.string().optional(),
        },
        async (args) => handleQueryMachineGraph(ctx, args),
      ),
      tool(
        "calculate_duty_cycle",
        "Deterministic duty-cycle lookup and rest-period calculation from manual tables.",
        {
          process: z.enum(["mig", "tig", "stick", "flux"]),
          inputVoltage: z.union([z.literal(120), z.literal(240)]),
          amps: z.number(),
        },
        async (args) => handleCalculateDutyCycle(ctx, args),
      ),
      tool(
        "validate_machine_configuration",
        "Validate a stated machine configuration against manual requirements.",
        {
          process: z.enum(["mig", "flux", "tig", "stick"]),
          polarityConfigId: z.string().optional(),
          inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
          consumableIds: z.array(z.string()).optional(),
        },
        async (args) => handleValidateMachineConfiguration(ctx, args),
      ),
      tool(
        "find_settings",
        "Retrieve settings-chart evidence and related tables for process/material/thickness.",
        {
          query: z.string().optional(),
          process: z.string().optional(),
          material: z.string().optional(),
          thickness: z.string().optional(),
          inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
          wireType: z.string().optional(),
          wireDiameter: z.string().optional(),
          shieldingGas: z.string().optional(),
        },
        async (args) => handleFindSettings(ctx, args),
      ),
      tool(
        "start_diagnostic_session",
        "Start a structured troubleshooting session with ranked hypotheses.",
        {
          sessionId: z.string().optional(),
          symptoms: z.array(z.string()).optional(),
          primarySymptom: z.string().optional(),
        },
        async (args) => handleStartDiagnosticSession(ctx, args),
      ),
      tool(
        "update_diagnostic_session",
        "Update diagnostic session with new symptoms, ruled-out hypotheses, or answered questions.",
        {
          sessionId: z.string(),
          newSymptoms: z.array(z.string()).optional(),
          ruledOutHypothesisIds: z.array(z.string()).optional(),
          answeredQuestion: z.string().optional(),
          evidenceSummary: z.string().optional(),
          questionRationale: z.string().optional(),
        },
        async (args) => handleUpdateDiagnosticSession(ctx, args),
      ),
      tool(
        "generate_artifact_spec",
        "Validate and register a typed ArtifactSpec for the workspace panel.",
        { spec: z.unknown() },
        async (args) => handleGenerateArtifactSpec(ctx, args),
      ),
      tool(
        "run_safety_review",
        "Run safety validation before recommending procedural or arc-on actions.",
        {
          mentionsArc: z.boolean().optional(),
          mentionsPower: z.boolean().optional(),
          safetyAcknowledged: z.boolean().optional(),
          proceduralAction: z.string().optional(),
        },
        async (args) => handleRunSafetyReview(ctx, args),
      ),
    ],
  });
}
