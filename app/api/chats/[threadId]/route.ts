import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";
import { getChatThreadMessages } from "@/lib/chat-history";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const auth = await createSupabaseServerClient();
    const {
      data: { user }
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId." }, { status: 400 });
    }

    const messages = await getChatThreadMessages(user.id, threadId);
    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
