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

    if (isFollowUpQuestion(message)) {
      const followUps = await getPendingFollowUps(user.id);
      const suggestions = followUps
        .slice(0, 3)
        .map((f) => `Follow up with ${f.contact.name}`);
      return NextResponse.json({
        followUps,
        reply:
          followUps.length === 0
            ? "You have no pending follow-ups due today or earlier."
            : `You have ${followUps.length} contact(s) to follow up with.`,
        suggestions
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

      return NextResponse.json({
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

      return NextResponse.json({
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
      return NextResponse.json({
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
      return NextResponse.json({
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
        return NextResponse.json({
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
          return NextResponse.json({ reply, suggestions: [] });
        }

        throw queryError;
      }
    }

    return NextResponse.json({
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
