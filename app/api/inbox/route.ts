import { NextResponse } from "next/server";
import { getRecentEmails } from "@/lib/gmail";
import { analyzeEmail, suggestReplyForEmail } from "@/lib/openai";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";
import { listInboundItems, upsertInboundItem } from "@/lib/inbound";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Gmail is optional; if not configured or denied, we still want the unified inbox to work.
    let emails: Awaited<ReturnType<typeof getRecentEmails>> = [];
    try {
      emails = await getRecentEmails();
    } catch {
      emails = [];
    }

    const analyzed = await Promise.all(
      emails.map(async (email) => {
        let analysis: Awaited<ReturnType<typeof analyzeEmail>> | null = null;
        try {
          analysis = await analyzeEmail({
            subject: email.subject,
            snippet: email.snippet
          });
        } catch {
          analysis = null;
        }

        // Keep only relevant brand emails; drop promos/spam.
        if (analysis && (!analysis.isBrandDeal || analysis.intent === "spam")) return null;

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
            fromName: email.from,
            fromEmail: null,
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
            const analysis = await analyzeEmail({ subject: email.subject, snippet: email.snippet });
            if (!analysis.isBrandDeal || analysis.intent === "spam") return null;
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

