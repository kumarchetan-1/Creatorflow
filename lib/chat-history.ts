import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

export type ChatThread = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function deriveThreadTitle(message: string): string {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (!normalized) return "New chat";
  return normalized.length > 60 ? `${normalized.slice(0, 60)}...` : normalized;
}

export async function listChatThreads(userId: string): Promise<ChatThread[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id,title,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatThread[];
}

export async function createChatThread(userId: string, title?: string): Promise<ChatThread> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({
      user_id: userId,
      title: title?.trim() || "New chat"
    })
    .select("id,title,created_at,updated_at")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create chat thread.");
  return data as ChatThread;
}

export async function getChatThreadMessages(
  userId: string,
  threadId: string
): Promise<ChatHistoryMessage[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,role,content,created_at")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatHistoryMessage[];
}

export async function appendChatMessage(input: {
  userId: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const cleanContent = input.content.trim();
  if (!cleanContent) return;

  const { error: insertError } = await supabase.from("chat_messages").insert({
    user_id: input.userId,
    thread_id: input.threadId,
    role: input.role,
    content: cleanContent
  });
  if (insertError) throw new Error(insertError.message);

  const updatePayload: { updated_at: string; title?: string } = {
    updated_at: new Date().toISOString()
  };
  if (input.role === "user") {
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("title")
      .eq("id", input.threadId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!thread || !thread.title || thread.title === "New chat") {
      updatePayload.title = deriveThreadTitle(cleanContent);
    }
  }

  const { error: updateError } = await supabase
    .from("chat_threads")
    .update(updatePayload)
    .eq("id", input.threadId)
    .eq("user_id", input.userId);
  if (updateError) throw new Error(updateError.message);
}
