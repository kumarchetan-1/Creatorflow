import { supabase } from "@/lib/supabaseClient";
import { createContact } from "@/lib/contacts";
import { normalizeContactName } from "@/lib/name";

type DealResult = {
  name: string;
  amount: number;
};

export async function createDeal(name: string, amount: number): Promise<DealResult> {
  const { displayName, searchName } = normalizeContactName(name);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  const { data: existingContact, error: contactLookupError } = await supabase
    .from("contacts")
    .select("id")
    .ilike("name", searchName)
    .limit(1)
    .maybeSingle();

  if (contactLookupError) {
    throw new Error(contactLookupError.message);
  }

  let contactId = existingContact?.id;

  if (!contactId) {
    const createdContact = await createContact(displayName, "brand");
    contactId = createdContact.id;
  }

  let { error: dealInsertError } = await supabase.from("deals").insert({
    contact_id: contactId,
    title: `${displayName} deal`,
    amount,
    status: "closed"
  });

  // Support existing DBs where deals table does not include "title".
  if (dealInsertError?.message.includes("'title' column")) {
    const retry = await supabase.from("deals").insert({
      contact_id: contactId,
      amount,
      status: "closed"
    });
    dealInsertError = retry.error;
  }

  if (dealInsertError) {
    throw new Error(dealInsertError.message);
  }

  return { name: displayName, amount };
}
