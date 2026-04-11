import { NextResponse } from "next/server";
import { getRecentEmailsForUser } from "@/lib/gmail";
import { analyzeEmail, suggestReplyForEmail } from "@/lib/openai";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";
import { listInboundItems, upsertInboundItem } from "@/lib/inbound";

function parseFromHeader(from: string): { fromName: string | null; fromEmail: string | null } {
  const raw = (from ?? "").trim();
  if (!raw) return { fromName: null, fromEmail: null };

  const emailMatch = raw.match(/<([^>]+)>/);
  if (emailMatch) {
    const email = emailMatch[1].trim().toLowerCase();
    const name = raw.replace(emailMatch[0], "").replace(/"/g, "").trim();
    return {
      fromName: name || email.split("@")[0] || null,
      fromEmail: email || null
    };
  }

  const plainEmailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (plainEmailMatch) {
    return {
      fromName: raw.replace(plainEmailMatch[0], "").replace(/"/g, "").trim() || null,
      fromEmail: plainEmailMatch[0].trim().toLowerCase()
    };
  }

  return { fromName: raw, fromEmail: null };
}

function shouldKeepChannelMessage(input: {
  from: string;
  subject: string;
  snippet: string;
  fromEmail: string | null;
}): boolean {
  const sourceText = `${input.from} ${input.subject} ${input.snippet}`.toLowerCase();
  const emailDomain = (input.fromEmail ?? "").toLowerCase();

  const hasLinkedInSignal =
    sourceText.includes("linkedin") ||
    emailDomain.endsWith("@linkedin.com") ||
    emailDomain.includes("linkedinmail.com");

  const hasUpworkSignal =
    sourceText.includes("upwork") ||
    sourceText.includes("proposal") ||
    sourceText.includes("invitation") ||
    sourceText.includes("interview") ||
    emailDomain.endsWith("@upwork.com");

  return hasLinkedInSignal || hasUpworkSignal;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Gmail is optional; if not configured or denied, we still want the unified inbox to work.
    let emails: Awaited<ReturnType<typeof getRecentEmailsForUser>> = [];
    try {
      emails = await getRecentEmailsForUser(user.id);
    } catch {
      emails = [];
    }

    const analyzed = await Promise.all(
      emails.map(async (email) => {
        const parsedFrom = parseFromHeader(email.from);
        const keepChannelMessage = shouldKeepChannelMessage({
          from: email.from,
          subject: email.subject,
          snippet: email.snippet,
          fromEmail: parsedFrom.fromEmail
        });

        let analysis: Awaited<ReturnType<typeof analyzeEmail>> | null = null;
        try {
          analysis = await analyzeEmail({
            subject: email.subject,
            snippet: email.snippet
          });
        } catch {
          analysis = null;
        }

        // Keep relevant brand emails, and always keep LinkedIn/Upwork message emails.
        if (analysis && !keepChannelMessage && (!analysis.isBrandDeal || analysis.intent === "spam")) {
          return null;
        }

        let suggestedReply = "";
        if (analysis) {
          try {
            const r = await suggestReplyForEmail({
              subject: email.subject,
              snippet: email.snippet,
              brandName: analysis.brandName,
              intent: analysis.intent,
              summary: analysis.summary
            });
            suggestedReply = r;
          } catch {
            suggestedReply = "";
          }
        }

        // Cache into the unified inbox (idempotent via external_id).
        try {
          await upsertInboundItem({
            userId: user.id,
            source: "email",
            externalId: email.id,
            fromName: parsedFrom.fromName ?? email.from,
            fromEmail: parsedFrom.fromEmail,
            fromHandle: parsedFrom.fromEmail?.includes("@linkedin")
              ? parsedFrom.fromEmail.split("@")[0]
              : null,
            subject: email.subject,
            snippet: email.snippet,
            body: null,
            receivedAt: null,
            status: "new",
            metadata: {
              brandName: analysis?.brandName ?? "",
              intent: analysis?.intent ?? "inquiry",
              summary: analysis?.summary ?? email.snippet,
              suggestedReply
            }
          });
        } catch {
          // If inbound_items doesn't exist yet (migrations not applied), ignore caching.
        }

        return null;
      })
    );

    void analyzed;

    let items: Awaited<ReturnType<typeof listInboundItems>> = [];
    try {
      items = await listInboundItems({
        userId: user.id,
        source: "all",
        status: "all",
        limit: 60
      });
    } catch (e) {
      // Fallback: if DB table isn't ready, return legacy Gmail-only items
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("inbound_items") || msg.toLowerCase().includes("relation")) {
        const legacy = await Promise.all(
          emails.map(async (email) => {
            const parsedFrom = parseFromHeader(email.from);
            const keepChannelMessage = shouldKeepChannelMessage({
              from: email.from,
              subject: email.subject,
              snippet: email.snippet,
              fromEmail: parsedFrom.fromEmail
            });
            const analysis = await analyzeEmail({ subject: email.subject, snippet: email.snippet });
            if (!keepChannelMessage && (!analysis.isBrandDeal || analysis.intent === "spam")) return null;
            const suggestedReply = await suggestReplyForEmail({
              subject: email.subject,
              snippet: email.snippet,
              brandName: analysis.brandName,
              intent: analysis.intent,
              summary: analysis.summary
            });
            return {
              id: `legacy_email_${email.id}`,
              source: "email",
              status: "new",
              received_at: new Date().toISOString(),
              subject: email.subject,
              from: email.from,
              brandName: analysis.brandName,
              summary: analysis.summary,
              suggestedReply
            };
          })
        );
        return NextResponse.json((legacy.filter(Boolean) as unknown[]) ?? []);
      }
      throw e;
    }

    // UI-facing shape (backward compatible-ish, but now multi-channel).
    const payload = items.map((it) => {
      const md = (it.metadata ?? {}) as Record<string, unknown>;
      return {
        id: it.id,
        source: it.source,
        status: it.status,
        received_at: it.received_at,
        subject: it.subject ?? "",
        from: it.from_email ?? it.from_handle ?? it.from_name ?? "",
        brandName: typeof md.brandName === "string" ? md.brandName : "",
        summary: typeof md.summary === "string" ? md.summary : it.snippet ?? "",
        suggestedReply: typeof md.suggestedReply === "string" ? md.suggestedReply : "",
        raw: {
          from_name: it.from_name,
          from_email: it.from_email,
          from_handle: it.from_handle
        }
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

