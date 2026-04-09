import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const stamp = now.toISOString();

    const samples = [
      {
        user_id: user.id,
        source: "instagram",
        external_id: `demo_ig_${stamp}`,
        thread_id: `demo_ig_thread_${stamp}`,
        from_handle: "@brandmanager",
        subject: "Instagram DM",
        snippet: "Hey! We’d love to collaborate for our next drop. Can you share rates?",
        body: "Hey! We’d love to collaborate for our next drop. Can you share rates + availability for next week?",
        status: "new",
        metadata: { channel: "instagram", brandName: "Demo Brand", summary: "Wants rates + availability." }
      },
      {
        user_id: user.id,
        source: "upwork",
        external_id: `demo_upwork_${stamp}`,
        thread_id: `demo_up_thread_${stamp}`,
        from_name: "Acme Agency",
        subject: "UGC videos for skincare brand",
        snippet: "Need 4 videos + 10 hooks. Budget $800. Can you share portfolio?",
        body: "Need 4 videos + 10 hooks. Budget $800. Can you share portfolio and timelines?",
        status: "new",
        metadata: { channel: "upwork", brandName: "Acme Agency", summary: "UGC request, budget mentioned." }
      },
      {
        user_id: user.id,
        source: "form",
        external_id: `demo_form_${stamp}`,
        from_name: "Jane (Brand)",
        from_email: "jane@brand.com",
        subject: "Collab inquiry",
        snippet: "We want a sponsored reel + story set for our launch.",
        body: "We want a sponsored reel + story set for our launch. Please share your rates and case studies.",
        status: "new",
        metadata: { channel: "form", brandName: "Jane / Brand", summary: "Inbound collab inquiry." }
      }
    ] as const;

    const { error } = await supabase
      .from("inbound_items")
      .upsert(samples as unknown as Record<string, unknown>[], {
        onConflict: "user_id,source,external_id"
      });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, inserted: samples.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

