import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function requireWebhookSecret(req: NextRequest) {
  const expected = process.env.INBOUND_WEBHOOK_SECRET;
  if (!expected) {
    throw new Error("Missing INBOUND_WEBHOOK_SECRET env var.");
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token || token !== expected) {
    throw new Error("Unauthorized webhook.");
  }
}

export async function POST(req: NextRequest) {
  try {
    requireWebhookSecret(req);

    const body = (await req.json()) as unknown;
    const userId = typeof (body as { userId?: unknown })?.userId === "string" ? (body as { userId: string }).userId : "";
    const fromHandle =
      typeof (body as { fromHandle?: unknown })?.fromHandle === "string"
        ? (body as { fromHandle: string }).fromHandle
        : null;
    const message =
      typeof (body as { message?: unknown })?.message === "string"
        ? (body as { message: string }).message
        : "";
    const threadId =
      typeof (body as { threadId?: unknown })?.threadId === "string"
        ? (body as { threadId: string }).threadId
        : null;
    const externalId =
      typeof (body as { externalId?: unknown })?.externalId === "string"
        ? (body as { externalId: string }).externalId
        : null;

    if (!userId) return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
    if (!fromHandle) return NextResponse.json({ ok: false, error: "Missing fromHandle." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("inbound_items")
      .upsert(
        {
          user_id: userId,
          source: "instagram",
          external_id: externalId,
          thread_id: threadId,
          from_handle: fromHandle,
          subject: "Instagram DM",
          snippet: message.slice(0, 160),
          body: message,
          status: "new",
          metadata: { channel: "instagram" }
        },
        externalId ? { onConflict: "user_id,source,external_id" } : undefined
      )
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}

