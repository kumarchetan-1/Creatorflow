import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";
import { isAdmin } from "@/lib/auth";
import { Button, Card, SectionHeader } from "@/components/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  const { data, error } = await supabase
    .from("users")
    .select("id,role")
    .eq("id", user.id)
    .single();

  if (error || !isAdmin(data)) redirect("/chat");

  return { user };
}

async function deleteUserAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const admin = createSupabaseAdminClient();
  // Delete from auth.users (cascades to public.users, and then to contacts/deals/tasks via FK).
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
}

export default async function AdminPage() {
  await requireAdmin();

  const admin = createSupabaseAdminClient();
  const [
    { count: usersCount, error: usersErr },
    { count: dealsCount, error: dealsErr },
    dealsSum,
    usersList,
    recentDeals,
    recentTasks
  ] = await Promise.all([
    admin.from("users").select("*", { count: "exact", head: true }),
    admin.from("deals").select("*", { count: "exact", head: true }),
    admin.from("deals").select("amount"),
    admin.from("users").select("id,email,created_at,role").order("created_at", { ascending: false }),
    admin
      .from("deals")
      .select("id,user_id,title,amount,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("tasks")
      .select("id,user_id,title,due_date,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (usersErr) throw new Error(usersErr.message);
  if (dealsErr) throw new Error(dealsErr.message);
  if (dealsSum.error) throw new Error(dealsSum.error.message);
  if (usersList.error) throw new Error(usersList.error.message);
  if (recentDeals.error) throw new Error(recentDeals.error.message);
  if (recentTasks.error) throw new Error(recentTasks.error.message);

  const totalRevenue = (dealsSum.data ?? []).reduce(
    (sum, row) => sum + Number((row as { amount?: unknown }).amount ?? 0),
    0
  );

  const recentUserIds = Array.from(
    new Set<string>([
      ...((recentDeals.data ?? []).map((d) => String((d as { user_id?: unknown }).user_id ?? "")).filter(Boolean) as string[]),
      ...((recentTasks.data ?? []).map((t) => String((t as { user_id?: unknown }).user_id ?? "")).filter(Boolean) as string[])
    ])
  );

  const userEmailById = new Map<string, string>();
  if (recentUserIds.length > 0) {
    const { data: emails, error: emailsErr } = await admin
      .from("users")
      .select("id,email")
      .in("id", recentUserIds);
    if (emailsErr) throw new Error(emailsErr.message);
    for (const row of emails ?? []) {
      userEmailById.set(String(row.id), String(row.email ?? ""));
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <SectionHeader title="Admin" description="Overview" className="mb-6" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="xl">
          <div className="text-xs cf-muted">Total users</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">
            {usersCount ?? 0}
          </div>
        </Card>

        <Card variant="xl">
          <div className="text-xs cf-muted">Total deals</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">
            {dealsCount ?? 0}
          </div>
        </Card>

        <Card variant="xl">
          <div className="text-xs cf-muted">Total revenue</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">
            {formatMoney(totalRevenue)}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <SectionHeader title="Users" description="All accounts" className="mb-3" />
        <Card variant="xl">
          {(usersList.data ?? []).length === 0 ? (
            <div className="text-sm cf-muted">No users found.</div>
          ) : (
            <div className="space-y-2">
              {(usersList.data ?? []).map((u) => (
                <div
                  key={u.id}
                  className="cf-row flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.email ?? "—"}</div>
                    <div className="mt-1 text-xs cf-muted">
                      Created: {fmtDateTime(String(u.created_at))}
                      {u.role ? (
                        <>
                          <span className="mx-2 text-[#1C1C1F]">•</span>
                          Role: {u.role}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <Button type="submit" className="w-full md:w-auto">
                      Delete
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="mt-2 text-xs cf-muted">
          Deleting a user removes their Auth account and cascades their data.
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div>
          <SectionHeader title="Recent deals" description="Latest activity across users" className="mb-3" />
          <Card variant="xl">
            {(recentDeals.data ?? []).length === 0 ? (
              <div className="text-sm cf-muted">No deals yet.</div>
            ) : (
              <div className="space-y-2">
                {(recentDeals.data ?? []).map((d) => {
                  const row = d as {
                    id: string;
                    user_id: string | null;
                    title: string | null;
                    amount: number | null;
                    status: string | null;
                    created_at: string | null;
                  };
                  const email = row.user_id ? userEmailById.get(row.user_id) : "";
                  return (
                    <div key={row.id} className="cf-row p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {row.title ?? "Deal"}
                          </div>
                          <div className="mt-1 text-xs cf-muted">
                            {email ? email : "—"} • {row.status ?? "—"} •{" "}
                            {row.created_at ? fmtDateTime(row.created_at) : "—"}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-medium">
                          {formatMoney(Number(row.amount ?? 0))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div>
          <SectionHeader title="Recent tasks" description="Latest follow-ups across users" className="mb-3" />
          <Card variant="xl">
            {(recentTasks.data ?? []).length === 0 ? (
              <div className="text-sm cf-muted">No tasks yet.</div>
            ) : (
              <div className="space-y-2">
                {(recentTasks.data ?? []).map((t) => {
                  const row = t as {
                    id: string;
                    user_id: string | null;
                    title: string | null;
                    status: string | null;
                    due_date: string | null;
                    created_at: string | null;
                  };
                  const email = row.user_id ? userEmailById.get(row.user_id) : "";
                  return (
                    <div key={row.id} className="cf-row p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{row.title ?? "Task"}</div>
                        <div className="mt-1 text-xs cf-muted">
                          {email ? email : "—"} • {row.status ?? "—"} • due{" "}
                          {row.due_date ? fmtDateTime(row.due_date) : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

