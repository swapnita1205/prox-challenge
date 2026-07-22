import { NextResponse } from "next/server";
import { SetupInputsSchema } from "@/lib/setup/schemas";
import { buildSetupPack } from "@/lib/setup/build-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const parsed = SetupInputsSchema.safeParse(
      (body as { inputs?: unknown }).inputs ?? body,
    );
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const pack = buildSetupPack(parsed.data);
    return NextResponse.json({ pack });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup pack generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
