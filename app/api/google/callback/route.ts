import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { upsertGoogleRefreshTokenForUser } from "@/lib/google-oauth-tokens";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-oauth-constants";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlPage(input: { title: string; body: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${input.title}</title>
    <style>
      body { margin: 0; padding: 24px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: #0B0B0C; color: #EDEDED; }
      .card { max-width: 760px; margin: 0 auto; border: 1px solid #1C1C1F; border-radius: 20px; padding: 18px; background: #111113; }
      h1 { font-size: 18px; margin: 0; }
      p { color: #9CA3AF; line-height: 1.45; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0B0B0C; border: 1px solid #1C1C1F; border-radius: 16px; padding: 12px; }
      code { color: #EDEDED; }
      a { color: #fff; }
      .btn { display: inline-block; margin-top: 12px; padding: 10px 14px; border-radius: 16px; background: #fff; color: #0B0B0C; text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${input.title}</h1>
      ${input.body}
      <a class="btn" href="/connections">Back to Connections</a>
    </div>
  </body>
</html>`;
}

function safeEqualState(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state") ?? "";

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? "";
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);

  if (errorParam) {
    const html = htmlPage({
      title: "Gmail connection cancelled",
      body: `<p>Google returned <strong>${escapeHtml(errorParam)}</strong>. This usually means you clicked “Cancel”, your account isn’t allowed (test users / internal app), or an admin policy blocked Gmail scopes.</p>`
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  if (!expectedState || !stateParam || !safeEqualState(expectedState, stateParam)) {
    const html = htmlPage({
      title: "Gmail connection failed",
      body: `<p>Invalid or expired OAuth state. Close this tab and start <strong>Connect Gmail</strong> again from Connections.</p>`
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  if (!code) {
    const html = htmlPage({
      title: "Gmail connection failed",
      body: `<p>Missing <code>?code=</code> in the callback URL.</p>`
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const html = htmlPage({
      title: "Sign in required",
      body: `<p>Your session expired during the Google prompt. Sign in to Creatorflow, then try <strong>Connect Gmail</strong> again.</p>`
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    const html = htmlPage({
      title: "Gmail connection failed",
      body: `<p>Missing <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> / <code>GOOGLE_REDIRECT_URI</code> in your environment.</p>`
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token?.trim();

    if (!refreshToken) {
      const html = htmlPage({
        title: "Gmail connection incomplete",
        body: `<p>Google did not return a <code>refresh_token</code>. Revoke Creatorflow’s access in your Google account, then connect again with <strong>prompt=consent</strong> (the app already requests this).</p>`
      });
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    try {
      await upsertGoogleRefreshTokenForUser(user.id, refreshToken);
    } catch (dbErr) {
      const hint =
        dbErr instanceof Error && dbErr.message.toLowerCase().includes("relation")
          ? " Apply the <code>google_oauth_tokens</code> migration in Supabase, then try again."
          : "";
      const errText = escapeHtml(dbErr instanceof Error ? dbErr.message : "Database error.");
      const html = htmlPage({
        title: "Could not save Gmail connection",
        body: `<p>${errText}${hint}</p>`
      });
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    const next = new URL("/connections", req.url);
    next.searchParams.set("gmail", "connected");
    return NextResponse.redirect(next);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token exchange failed.";
    const html = htmlPage({
      title: "Gmail connection failed",
      body: `<p>${escapeHtml(msg)}</p>`
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
}
