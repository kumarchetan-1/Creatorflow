import { NextRequest, NextResponse } from "next/server";
import { extractIntent } from "@/lib/openai";
import { createContact } from "@/lib/contacts";
import { createDeal } from "@/lib/deals";
import { formatINR } from "@/lib/format";
import { createTask } from "@/lib/tasks";
import { handleQuery } from "@/lib/query";
import { formatQueryResponse } from "@/lib/query-format";
import { answerQueryFromData } from "@/lib/query-ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Request body must include a non-empty message string." },
        { status: 400 }
      );
    }

    const extracted = await extractIntent(message);

    if (extracted.intent === "create_contact") {
      const { name, type } = extracted.entities;
      if (!name || !type) {
        return NextResponse.json(
          { error: "Missing required entities for create_contact." },
          { status: 400 }
        );
      }

      await createContact(name, type);

      return NextResponse.json({ reply: `Added ${name} as a ${type} ✅` });
    }

    if (extracted.intent === "create_deal") {
      const { name, amount } = extracted.entities;
      if (!name || amount == null) {
        return NextResponse.json(
          { error: "Missing required entities for create_deal." },
          { status: 400 }
        );
      }

      const deal = await createDeal(name, amount);
      return NextResponse.json({
        reply: `Logged deal with ${deal.name} for ${formatINR(deal.amount)} 💰`
      });
    }

    if (extracted.intent === "create_task") {
      const { name, title, date } = extracted.entities;
      if (!name || !title || !date) {
        return NextResponse.json(
          { error: "Missing required entities for create_task." },
          { status: 400 }
        );
      }

      const task = await createTask(name, title, date);
      return NextResponse.json({
        reply: `Reminder set: ${task.title} with ${task.name} ${date} ⏰`
      });
    }

    if (extracted.intent === "query") {
      try {
        const queryResult = await handleQuery(extracted.entities);
        const reply = formatQueryResponse(queryResult.type, queryResult);
        return NextResponse.json({ reply });
      } catch (queryError) {
        const queryErrorMessage =
          queryError instanceof Error ? queryError.message : "Unknown query parsing error";

        if (
          queryErrorMessage.includes("Unsupported query type") ||
          queryErrorMessage.includes("Name is required")
        ) {
          const reply = await answerQueryFromData(message);
          return NextResponse.json({ reply });
        }

        throw queryError;
      }
    }

    return NextResponse.json({
      reply: "Got it. I can add contacts, log deals, and set reminders."
    });
  } catch (error) {
    console.error("POST /api/chat failed", {
      error: error instanceof Error ? error.message : error
    });
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
