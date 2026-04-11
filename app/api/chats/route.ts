import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";
import { createChatThread, listChatThreads } from "@/lib/chat-history";

export async function GET() {
  try {
    const auth = await createSupabaseServerClient();
    const {
      data: { user }
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const threads = await listChatThreads(user.id);
    return NextResponse.json({ threads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await createSupabaseServerClient();
    const {
      data: { user }
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title : undefined;
    const thread = await createChatThread(user.id, title);
    return NextResponse.json({ thread });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
