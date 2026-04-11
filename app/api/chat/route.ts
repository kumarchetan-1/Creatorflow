import { NextRequest, NextResponse } from "next/server";
import { extractIntent, generateNegotiationReply } from "@/lib/openai";
import { createContact } from "@/lib/contacts";
import { createDeal } from "@/lib/deals";
import { formatINR } from "@/lib/format";
import { createTask, getPendingFollowUps } from "@/lib/tasks";
import { handleQuery } from "@/lib/query";
import { formatQueryResponse } from "@/lib/query-format";
import { answerQueryFromData } from "@/lib/query-ai";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";
import { upsertInboundItem } from "@/lib/inbound";
import { appendChatMessage, createChatThread } from "@/lib/chat-history";

function buildSuggestions(input: {
  name?: string | null;
  hasAmount?: boolean;
}): string[] {
  const suggestions: string[] = [];
  const cleanName = input.name?.trim() ?? "";
  if (cleanName) {
    suggestions.push(`Follow up with ${cleanName}`);
  }
  if (input.hasAmount) {
    suggestions.push("Negotiate this deal");
  }
  return Array.from(new Set(suggestions));
}

function isFollowUpQuestion(message: string): boolean {
  const m = message.trim().toLowerCase();
  return (
    m === "who do i need to follow up with?" ||
    m === "who do i need to follow up with" ||
    m.includes("who do i need to follow up with")
  );
}

function extractRelativeDate(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("tomorrow")) return "tomorrow";
  if (t.includes("today")) return "today";
  const inDays = t.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDays) return `in ${inDays[1]} days`;
  return null;
}

function parseManualInbound(message: string):
  | { source: "instagram"; fromHandle: string; body: string }
  | { source: "upwork"; fromName: string | null; subject: string; body: string }
  | { source: "form"; fromName: string | null; fromEmail: string | null; subject: string; body: string }
  | null {
  const m = message.trim();

  // Examples:
  // "Log IG DM from @nike: hey we want to collab"
  // "Log Instagram DM from nike: ..."
  const ig = m.match(/^\s*log\s+(ig|instagram)\s+dm\s+from\s+(@?[a-z0-9._]+)\s*:\s*([\s\S]+)$/i);
  if (ig) {
    const handle = ig[2].startsWith("@") ? ig[2] : `@${ig[2]}`;
    return { source: "instagram", fromHandle: handle, body: ig[3].trim() };
  }

  // "Log Upwork from Acme: Project title | message..."
  const up = m.match(/^\s*log\s+upwork(?:\s+from\s+([^:]+))?\s*:\s*([^|]+)\|\s*([\s\S]+)$/i);
  if (up) {
    return {
      source: "upwork",
      fromName: (up[1] ?? "").trim() || null,
      subject: up[2].trim(),
      body: up[3].trim()
    };
  }

  // "Log form from Jane <jane@x.com>: subject | message"
  const form = m.match(/^\s*log\s+form(?:\s+from\s+([^<:]+)\s*(?:<([^>]+)>)?)?\s*:\s*([^|]+)\|\s*([\s\S]+)$/i);
  if (form) {
    return {
      source: "form",
      fromName: (form[1] ?? "").trim() || null,
      fromEmail: (form[2] ?? "").trim() || null,
      subject: form[3].trim(),
      body: form[4].trim()
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await createSupabaseServerClient();
    const {
      data: { user }
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const message = body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Request body must include a non-empty message string." },
        { status: 400 }
      );
    }

    const requestedThreadId =
      typeof body?.threadId === "string" ? body.threadId.trim() : "";
    let activeThreadId = requestedThreadId;
    if (activeThreadId) {
      const { data: existingThread } = await auth
        .from("chat_threads")
        .select("id")
        .eq("id", activeThreadId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existingThread) activeThreadId = "";
    }
    if (!activeThreadId) {
      const createdThread = await createChatThread(user.id);
      activeThreadId = createdThread.id;
    }

    await appendChatMessage({
      userId: user.id,
      threadId: activeThreadId,
      role: "user",
      content: message
    });

    const respond = async (payload: {
      reply: string;
      suggestions?: string[];
      extra?: Record<string, unknown>;
    }) => {
      await appendChatMessage({
        userId: user.id,
        threadId: activeThreadId,
        role: "assistant",
        content: payload.reply
      });
      return NextResponse.json({
        reply: payload.reply,
        suggestions: payload.suggestions ?? [],
        threadId: activeThreadId,
        ...(payload.extra ?? {})
      });
    };

    const manualInbound = parseManualInbound(message);
    if (manualInbound) {
      if (manualInbound.source === "instagram") {
        await upsertInboundItem({
          userId: user.id,
          source: "instagram",
          externalId: null,
          threadId: null,
          fromHandle: manualInbound.fromHandle,
          subject: "Instagram DM",
          snippet: manualInbound.body.slice(0, 160),
          body: manualInbound.body,
          status: "new",
          metadata: { channel: "instagram" }
        });
        return await respond({
          reply: `Logged Instagram DM from ${manualInbound.fromHandle}. It’s now in your Inbox.`,
          suggestions: ["Open Inbox", "Convert to deal", "Set a follow up for tomorrow"]
        });
      }

      if (manualInbound.source === "upwork") {
        await upsertInboundItem({
          userId: user.id,
          source: "upwork",
          externalId: null,
          threadId: null,
          fromName: manualInbound.fromName,
          subject: manualInbound.subject,
          snippet: manualInbound.body.slice(0, 160),
          body: manualInbound.body,
          status: "new",
          metadata: { channel: "upwork" }
        });
        return await respond({
          reply: "Logged Upwork lead. It’s now in your Inbox.",
          suggestions: ["Open Inbox", "Draft a proposal reply", "Convert to deal"]
        });
      }

      await upsertInboundItem({
        userId: user.id,
        source: "form",
        externalId: null,
        threadId: null,
        fromName: manualInbound.fromName,
        fromEmail: manualInbound.fromEmail,
        subject: manualInbound.subject,
        snippet: manualInbound.body.slice(0, 160),
        body: manualInbound.body,
        status: "new",
        metadata: { channel: "form" }
      });
      return await respond({
        reply: "Logged inbound form submission. It’s now in your Inbox.",
        suggestions: ["Open Inbox", "Convert to deal", "Set a follow up for tomorrow"]
      });
    }

    if (isFollowUpQuestion(message)) {
      const followUps = await getPendingFollowUps(user.id);
      const suggestions = followUps
        .slice(0, 3)
        .map((f) => `Follow up with ${f.contact.name}`);
      return await respond({
        reply:
          followUps.length === 0
            ? "You have no pending follow-ups due today or earlier."
            : `You have ${followUps.length} contact(s) to follow up with.`,
        suggestions,
        extra: { followUps }
      });
    }

    const extracted = await extractIntent(message);

    if (extracted.intent === "negotiate") {
      const { name, amount, message: extractedMessage } = extracted.entities;
      if (!name) {
        return NextResponse.json(
          { error: "Missing required entities for negotiate (name)." },
          { status: 400 }
        );
      }

      const reply = await generateNegotiationReply({
        name,
        amount: amount ?? null,
        message: extractedMessage ?? message
      });

      return await respond({
        reply,
        suggestions: buildSuggestions({ name, hasAmount: amount != null })
      });
    }

    if (extracted.intent === "create_contact") {
      const { name } = extracted.entities;
      if (!name) {
        return NextResponse.json(
          { error: "Missing required entities for create_contact." },
          { status: 400 }
        );
      }

      await createContact(user.id, name, "brand");

      return await respond({
        reply: `Added ${name} as a brand ✅`,
        suggestions: buildSuggestions({ name })
      });
    }

    if (extracted.intent === "create_deal") {
      const { name, amount } = extracted.entities;
      if (!name || amount == null) {
        return NextResponse.json(
          { error: "Missing required entities for create_deal." },
          { status: 400 }
        );
      }

      const deal = await createDeal(user.id, name, amount);
      return await respond({
        reply: `Logged deal with ${deal.name} for ${formatINR(deal.amount)} 💰`,
        suggestions: buildSuggestions({ name: deal.name, hasAmount: true })
      });
    }

    if (extracted.intent === "create_task") {
      const { name, title, date, message: taskMessage } = extracted.entities;
      const effectiveTitle = (title ?? "Follow up").trim();
      const effectiveDate = (date ?? extractRelativeDate(message) ?? "").trim();

      if (!name || !effectiveTitle || !effectiveDate) {
        return NextResponse.json(
          { error: "Missing required entities for create_task." },
          { status: 400 }
        );
      }

      const task = await createTask(user.id, name, effectiveTitle, effectiveDate);
      return await respond({
        reply: `Reminder set: ${task.title} with ${task.name} ${task.due_date} ⏰`,
        suggestions: buildSuggestions({ name })
      });
    }

    if (extracted.intent === "query") {
      try {
        const queryEntities = {
          name: extracted.entities.name ?? null,
          type: (extracted.entities.type ?? extracted.entities.message ?? null) as
            | string
            | null
        };

        const queryResult = await handleQuery(user.id, queryEntities);
        const reply = formatQueryResponse(queryResult.type, queryResult);
        return await respond({
          reply,
          suggestions: buildSuggestions({
            name: extracted.entities.name ?? null,
            hasAmount: false
          })
        });
      } catch (queryError) {
        const queryErrorMessage =
          queryError instanceof Error ? queryError.message : "Unknown query parsing error";

        if (
          queryErrorMessage.includes("Unsupported query type") ||
          queryErrorMessage.includes("Name is required")
        ) {
          const reply = await answerQueryFromData(user.id, message);
          return await respond({ reply, suggestions: [] });
        }

        throw queryError;
      }
    }

    return await respond({
      reply: "Got it. I can add contacts, log deals, and set reminders.",
      suggestions: []
    });
  } catch (error) {
    console.error("POST /api/chat failed", {
      error: error instanceof Error ? error.message : error
    });
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
