import { NextRequest, NextResponse } from "next/server";
import { generateDailyManagerReport } from "@/lib/manager-report";
import { generateAISummary } from "@/lib/openai";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

type DailyPayload = {
  summary: string;
  suggestions: string[];
  data: unknown;
};

let cached: { dayKey: string; payload: DailyPayload } | null = null;

function dayKey(date = new Date()): string {
  // YYYY-MM-DD in server timezone
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await createSupabaseServerClient();
    const {
      data: { user }
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = dayKey();
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    if (!refresh && cached && cached.dayKey === today) {
      return NextResponse.json(cached.payload);
    }

    const data = await generateDailyManagerReport(user.id);
    const ai = await generateAISummary({
      tasks: data.tasks,
      deals: data.recentDeals,
      earnings: {
        totalEarnings: data.totalEarnings,
        topBrand: data.topBrand
      }
    });

    const payload: DailyPayload = {
      summary: ai.summary,
      suggestions: ai.suggestions,
      data
    };

    cached = { dayKey: today, payload };
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

