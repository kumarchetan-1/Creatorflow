import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getGoogleRefreshTokenForUser(userId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("google_oauth_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.refresh_token) return null;
  return data.refresh_token;
}

export async function upsertGoogleRefreshTokenForUser(
  userId: string,
  refreshToken: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("google_oauth_tokens").upsert(
    {
      user_id: userId,
      refresh_token: refreshToken,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
}
