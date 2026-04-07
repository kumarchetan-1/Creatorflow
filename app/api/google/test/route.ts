import { NextResponse } from "next/server";
import { getGmailClient } from "@/lib/gmail";

export async function GET() {
  try {
    // Basic sanity check: can we authenticate and call Gmail?
    const gmail = getGmailClient();
    const profile = await gmail.users.getProfile({ userId: "me" });

    return NextResponse.json({
      ok: true,
      emailAddress: profile.data.emailAddress ?? null,
      messagesTotal: profile.data.messagesTotal ?? null,
      threadsTotal: profile.data.threadsTotal ?? null,
      historyId: profile.data.historyId ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

