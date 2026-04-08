"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/auth-client";
import { Button, Card, Input, SectionHeader } from "@/components/ui";

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;

      router.push("/chat");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-1px)] w-full max-w-md items-center px-6 py-10">
      <div className="w-full">
        <SectionHeader
          title="Welcome back"
          description="Sign in to continue."
          className="mb-4"
        />

        <Card variant="xl">
          <form onSubmit={onSubmit} className="space-y-3">
            <Button
              type="button"
              disabled={loading}
              className="w-full justify-center"
              onClick={async () => {
                if (loading) return;
                setError(null);
                setLoading(true);
                try {
                  const supabase = createSupabaseBrowserClient();
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback?next=/chat`
                    }
                  });
                  if (error) throw error;
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Google sign-in failed.";
                  setError(msg);
                  setLoading(false);
                }
              }}
            >
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-[#1C1C1F]" />
              <div className="text-xs cf-muted">or</div>
              <div className="h-px flex-1 bg-[#1C1C1F]" />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs cf-muted">Email</div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs cf-muted">Password</div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error ? <div className="text-sm">{error}</div> : null}

            <div className="pt-2 space-y-3">
              <Button variant="primary" type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in…" : "Sign in"}
              </Button>

              <div className="text-sm cf-muted">
                New here?{" "}
                <Link href="/signup" className="cf-link">
                  Create an account
                </Link>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}

