import { google, gmail_v1 } from "googleapis";
import { getGoogleRefreshTokenForUser } from "@/lib/google-oauth-tokens";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send"
];

export type RecentEmail = {
  subject: string;
  from: string;
  snippet: string;
  id: string;
};

function getOAuth2ClientBase() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google OAuth environment variables.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function resolveRefreshTokenForUser(userId: string): Promise<string | null> {
  const fromDb = await getGoogleRefreshTokenForUser(userId);
  if (fromDb) return fromDb;
  // Single-tenant local dev convenience only — never use shared env tokens in production.
  if (process.env.NODE_ENV === "production") return null;
  return process.env.GOOGLE_REFRESH_TOKEN?.trim() || null;
}

/** True if this user can call Gmail APIs (DB token or dev-only env fallback). */
export async function userHasGoogleRefreshToken(userId: string): Promise<boolean> {
  return (await resolveRefreshTokenForUser(userId)) != null;
}

export function getGoogleAuthUrl(state: string): string {
  const oauth2Client = getOAuth2ClientBase();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state
  });
}

export function getGmailClientForRefreshToken(refreshToken: string): gmail_v1.Gmail {
  const auth = getOAuth2ClientBase();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

export async function getGmailClientForUser(userId: string): Promise<gmail_v1.Gmail> {
  const refreshToken = await resolveRefreshTokenForUser(userId);
  if (!refreshToken) {
    throw new Error("Gmail is not connected for this account.");
  }
  return getGmailClientForRefreshToken(refreshToken);
}

function getHeaderValue(
  headers: Array<gmail_v1.Schema$MessagePartHeader> | undefined,
  name: string
): string {
  const value = headers?.find((h) => (h.name ?? "").toLowerCase() === name.toLowerCase())?.value;
  return (value ?? "").trim();
}

export async function getRecentEmailsForUser(userId: string): Promise<RecentEmail[]> {
  const gmail = await getGmailClientForUser(userId);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: 10
  });

  const messages = listRes.data.messages ?? [];
  if (!messages.length) return [];

  const detailed = await Promise.all(
    messages
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map(async (id) => {
        const msgRes = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["Subject", "From"]
        });

        const headers = msgRes.data.payload?.headers;
        const subject = getHeaderValue(headers, "Subject");
        const from = getHeaderValue(headers, "From");
        const snippet = (msgRes.data.snippet ?? "").trim();

        return {
          id,
          subject,
          from,
          snippet
        } satisfies RecentEmail;
      })
  );

  return detailed;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sendEmailForUser(
  userId: string,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const gmail = await getGmailClientForUser(userId);

  const cleanTo = to.trim();
  const cleanSubject = subject.trim();
  const cleanBody = body.replace(/\r\n/g, "\n").trim();

  if (!cleanTo) throw new Error("Missing recipient email (to).");
  if (!cleanSubject) throw new Error("Missing subject.");
  if (!cleanBody) throw new Error("Missing body.");

  const rfc822 =
    `To: ${cleanTo}\r\n` +
    `Subject: ${cleanSubject}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: 7bit\r\n` +
    `\r\n` +
    `${cleanBody}\r\n`;

  const raw = base64UrlEncode(rfc822);
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw }
  });

  return res.data.id ?? "sent";
}

export { GMAIL_SCOPES };
