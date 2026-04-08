import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

export async function getSupabaseAuthed() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return { supabase, user };
}
