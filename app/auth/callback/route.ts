import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

function safeNextPath(next: string | null): string {
  if (!next) return "/chat";
  if (!next.startsWith("/") || next.startsWith("//")) return "/chat";
  return next;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user?.id) {
        // Ensure app-level user row exists (safe to call on every login).
        await supabase
          .from("users")
          .upsert({ id: user.id, email: user.email }, { onConflict: "id" });
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

