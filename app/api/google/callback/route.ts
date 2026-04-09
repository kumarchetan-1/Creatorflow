import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    const html = htmlPage({
      title: "Gmail connection cancelled",
      body: `<p>Google returned <strong>${errorParam}</strong>. This usually means you clicked “Cancel”, your account isn’t allowed (test users / internal app), or an admin policy blocked Gmail scopes.</p>`
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

  // Never leak tokens in production logs/responses.
  if (process.env.NODE_ENV === "production") {
    const html = htmlPage({
      title: "Gmail connection requires server-side storage",
      body: `<p>Token exchange is disabled in production for safety. Store OAuth tokens per user in the database instead of environment variables, then connect Gmail from a secure server flow.</p>`
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  try {
    const { tokens } = await oauth2Client.getToken(code);

    const html = htmlPage({
      title: "Gmail connected (local dev)",
      body: `<p>Next step: copy the <strong>refresh token</strong> into <code>GOOGLE_REFRESH_TOKEN</code> in <code>.env.local</code>, then restart <code>npm run dev</code>.</p>
<pre>${JSON.stringify(
  {
    refresh_token: tokens.refresh_token ?? null,
    scope: tokens.scope ?? null,
    token_type: tokens.token_type ?? null,
    expiry_date: tokens.expiry_date ?? null
  },
  null,
  2
)}</pre>
<p>If <code>refresh_token</code> is <code>null</code>, remove any existing <code>GOOGLE_REFRESH_TOKEN</code> and re-run the flow (Google won’t always re-issue it unless you force consent).</p>`
    });

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token exchange failed.";
    const html = htmlPage({
      title: "Gmail connection failed",
      body: `<p>${msg}</p>`
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
}

