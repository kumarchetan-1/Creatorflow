import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.json({ error: errorParam }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing ?code= in callback URL." }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI." },
      { status: 500 }
    );
  }

  // Never leak tokens in production logs/responses.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "OAuth token exchange endpoint is disabled in production." },
      { status: 403 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);

  return NextResponse.json({
    ok: true,
    received: {
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date
    },
    refresh_token: tokens.refresh_token ?? null,
    note:
      "Copy refresh_token into GOOGLE_REFRESH_TOKEN (once). If refresh_token is null, remove GOOGLE_REFRESH_TOKEN and re-run the flow to force a new consent."
  });
}

