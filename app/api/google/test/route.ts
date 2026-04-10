import { NextResponse } from "next/server";
import { getGmailClientForUser } from "@/lib/gmail";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const gmail = await getGmailClientForUser(user.id);
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
