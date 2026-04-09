"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/auth-client";
import { Button, Card } from "@/components/ui";

export default function SidebarUser() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const signedIn = useMemo(() => Boolean(email), [email]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) {
        setEmail(data.user?.email ?? null);
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Card variant="default" className="px-3 py-3 text-sm">
      <div className="text-sm font-medium">Account</div>
      <div className="mt-0.5 text-xs cf-muted">
        {loading ? "Checking…" : signedIn ? `Signed in as ${email}` : "Signed out"}
      </div>

      <div className="mt-3">
        {signedIn ? (
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
        ) : (
          <Button
            type="button"
            variant="primary"
            className="w-full justify-center"
            onClick={() => {
              router.push("/signin");
            }}
          >
            Sign in
          </Button>
        )}
      </div>
    </Card>
  );
}

