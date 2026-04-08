import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function createSupabaseServerClient() {
  return createClient(await cookies());
}

