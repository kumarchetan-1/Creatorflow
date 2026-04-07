import { NextResponse } from "next/server";
import { getRecentEmails } from "@/lib/gmail";
import { analyzeEmail, suggestReplyForEmail } from "@/lib/openai";

export async function GET() {
  try {
    const emails = await getRecentEmails();

    const analyzed = await Promise.all(
      emails.map(async (email) => {
        const analysis = await analyzeEmail({
          subject: email.subject,
          snippet: email.snippet
        });

        if (!analysis.isBrandDeal) return null;

        const suggestedReply = await suggestReplyForEmail({
          subject: email.subject,
          snippet: email.snippet,
          brandName: analysis.brandName,
          intent: analysis.intent,
          summary: analysis.summary
        });

        return {
          subject: email.subject,
          from: email.from,
          brandName: analysis.brandName,
          summary: analysis.summary,
          suggestedReply
        };
      })
    );

    return NextResponse.json(analyzed.filter(Boolean));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

