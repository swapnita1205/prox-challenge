import { NextRequest } from "next/server";
import { ChatRequestSchema } from "@/lib/schemas/api";
import { runWeldPilotAgent, runPlaceholderAgent } from "@/lib/agent/runner";
import { hasValidApiKey, getEnvError } from "@/lib/env";
import { MachineStateSchema } from "@/lib/schemas/conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.errors.map((e) => e.message).join("; ") },
      { status: 400 },
    );
  }

  const { mode, message, machineState: rawMachineState } = parsed.data;

  const machineState = rawMachineState
    ? MachineStateSchema.safeParse({ ...rawMachineState, mode }).data
    : undefined;

  if (!hasValidApiKey()) {
    const envError = getEnvError();
    if (envError) {
      // Fall back to placeholder when API key missing
      const stream = createSseStream(runPlaceholderAgent(mode, message));
      return streamResponse(stream);
    }
  }

  const agentStream = hasValidApiKey()
    ? runWeldPilotAgent({ mode, message, machineState })
    : runPlaceholderAgent(mode, message);

  return streamResponse(createSseStream(agentStream));
}

function createSseStream(
  events: AsyncGenerator<import("@/lib/schemas/api").StreamEvent>,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(sseLine(event)));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream failed";
        controller.enqueue(
          encoder.encode(sseLine({ type: "error", message: msg })),
        );
      } finally {
        controller.close();
      }
    },
  });
}

function streamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
