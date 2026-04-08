import { supabase } from "@/lib/supabaseClient";
import { normalizeContactName } from "@/lib/name";

type ContactRecord = {
  id: string;
  name: string;
  type: string;
  created_at: string;
};

export async function createContact(
  userId: string,
  name: string,
  type: string
): Promise<ContactRecord> {
  const { displayName, searchName } = normalizeContactName(name);
  const trimmedType = type.trim();

  if (!userId) {
    throw new Error("Missing userId.");
  }

  if (!trimmedType) {
    throw new Error("Both name and type are required.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("contacts")
    .select("id,name,type,created_at")
    .eq("user_id", userId)
    .ilike("name", searchName)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing as ContactRecord;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({ user_id: userId, name: displayName, type: trimmedType.toLowerCase() })
    .select("id,name,type,created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create contact.");
  }

  return data as ContactRecord;
}
