import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/gmail";
import { GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_OAUTH_STATE_MAX_AGE_SEC } from "@/lib/google-oauth-constants";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const signin = new URL("/signin", request.url);
    signin.searchParams.set("next", "/connections");
    return NextResponse.redirect(signin);
  }

  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SEC
  });

  try {
    const googleUrl = getGoogleAuthUrl(state);
    return NextResponse.redirect(googleUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
