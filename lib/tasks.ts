import { supabase } from "@/lib/supabaseClient";
import { parseDate } from "@/lib/date";
import { createContact } from "@/lib/contacts";

type TaskResult = {
  name: string;
  title: string;
  due_date: string;
};

export type PendingFollowUpContact = {
  contact: {
    id: string;
    name: string;
    type: string | null;
  };
  nextTask: {
    id: string;
    title: string;
    due_date: string;
  };
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function createTask(
  userId: string,
  name: string,
  title: string,
  dateString: string
): Promise<TaskResult> {
  const trimmedName = name.trim();
  const trimmedTitle = title.trim();
  const trimmedDate = dateString.trim();
  if (!userId) {
    throw new Error("Missing userId.");
  }
  if (!trimmedName || !trimmedTitle || !trimmedDate) {
    throw new Error("Task name, title, and date are required.");
  }

  const { data: existingContact, error: contactLookupError } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("name", trimmedName)
    .limit(1)
    .maybeSingle();

  if (contactLookupError) {
    throw new Error(contactLookupError.message);
  }

  let contactId = existingContact?.id;
  if (!contactId) {
    const created = await createContact(userId, trimmedName, "brand");
    contactId = created.id;
  }

  const dueDate = toIsoDate(parseDate(trimmedDate));

  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    contact_id: contactId,
    title: trimmedTitle,
    due_date: dueDate,
    status: "pending"
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    name: trimmedName,
    title: trimmedTitle,
    due_date: dueDate
  };
}

export async function getPendingFollowUps(userId: string): Promise<PendingFollowUpContact[]> {
  if (!userId) throw new Error("Missing userId.");
  const today = toIsoDate(new Date());

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      id,
      title,
      due_date,
      contact:contacts (
        id,
        name,
        type
      )
    `
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    due_date: string;
    contact:
      | Array<{
          id: string;
          name: string;
          type?: string | null;
        }>
      | null;
  }>;

  const seen = new Set<string>();
  const out: PendingFollowUpContact[] = [];

  for (const row of rows) {
    const c = Array.isArray(row.contact) ? row.contact[0] : null;
    if (!c?.id || seen.has(c.id)) continue;
    seen.add(c.id);

    out.push({
      contact: {
        id: c.id,
        name: c.name,
        type: c.type ?? null
      },
      nextTask: {
        id: row.id,
        title: row.title,
        due_date: row.due_date
      }
    });
  }

  return out;
}
