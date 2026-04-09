import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";
import { getRecentEmails } from "@/lib/gmail";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const env = {
      hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      hasRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
      hasRefreshToken: Boolean(process.env.GOOGLE_REFRESH_TOKEN)
    };

    if (!env.hasClientId || !env.hasClientSecret || !env.hasRedirectUri || !env.hasRefreshToken) {
      return NextResponse.json({
        ok: true,
        connected: false,
        env,
        message: "Missing Google OAuth environment variables."
      });
    }

    try {
      const emails = await getRecentEmails();
      return NextResponse.json({
        ok: true,
        connected: true,
        env,
        inboxCount: emails.length,
        sample: emails.slice(0, 3).map((e) => ({ id: e.id, subject: e.subject, from: e.from }))
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch Gmail.";
      return NextResponse.json({
        ok: true,
        connected: false,
        env,
        message: msg
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

