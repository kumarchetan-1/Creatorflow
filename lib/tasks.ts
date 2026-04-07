import { supabase } from "@/lib/supabaseClient";
import { parseDate } from "@/lib/date";
import { createContact } from "@/lib/contacts";

type TaskResult = {
  name: string;
  title: string;
  due_date: string;
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function createTask(
  name: string,
  title: string,
  dateString: string
): Promise<TaskResult> {
  const trimmedName = name.trim();
  const trimmedTitle = title.trim();
  const trimmedDate = dateString.trim();
  if (!trimmedName || !trimmedTitle || !trimmedDate) {
    throw new Error("Task name, title, and date are required.");
  }

  const { data: existingContact, error: contactLookupError } = await supabase
    .from("contacts")
    .select("id")
    .eq("name", trimmedName)
    .limit(1)
    .maybeSingle();

  if (contactLookupError) {
    throw new Error(contactLookupError.message);
  }

  let contactId = existingContact?.id;
  if (!contactId) {
    const created = await createContact(trimmedName, "brand");
    contactId = created.id;
  }

  const dueDate = toIsoDate(parseDate(trimmedDate));

  const { error } = await supabase.from("tasks").insert({
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
