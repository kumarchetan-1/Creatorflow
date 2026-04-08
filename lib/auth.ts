export type AppUser = {
  id: string;
  role?: string | null;
};

export function isAdmin(user: AppUser | null | undefined): boolean {
  return (user?.role ?? "").toLowerCase() === "admin";
}

