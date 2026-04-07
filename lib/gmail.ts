import { google, gmail_v1 } from "googleapis";

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

export function getGoogleAuthUrl(): string {
  const oauth2Client = getOAuth2ClientBase();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES
  });
}

export function getGmailClient(): gmail_v1.Gmail {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("Missing GOOGLE_REFRESH_TOKEN. Complete OAuth flow to obtain one.");
  }

  const auth = getOAuth2ClientBase();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

function getHeaderValue(
  headers: Array<gmail_v1.Schema$MessagePartHeader> | undefined,
  name: string
): string {
  const value = headers?.find((h) => (h.name ?? "").toLowerCase() === name.toLowerCase())?.value;
  return (value ?? "").trim();
}

export async function getRecentEmails(): Promise<RecentEmail[]> {
  const gmail = getGmailClient();

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

export async function sendEmail(to: string, subject: string, body: string): Promise<string> {
  const gmail = getGmailClient();

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
