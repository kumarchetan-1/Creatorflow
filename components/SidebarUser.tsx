"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/auth-client";
import { Button, Card } from "@/components/ui";

export default function SidebarUser() {
  const router = useRouter();

  return (
    <Card variant="default" className="px-3 py-3 text-sm">
      <div className="text-sm font-medium">Account</div>
      <div className="mt-0.5 text-xs cf-muted">Signed in</div>

      <div className="mt-3">
        <Button
          type="button"
          className="w-full justify-center"
          onClick={async () => {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.signOut();
            router.push("/signin");
            router.refresh();
          }}
        >
          Log out
        </Button>
      </div>
    </Card>
  );
}

