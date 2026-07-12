"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? "/write";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm space-y-8 py-10">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-4xl text-stone-900">Commonplace</h1>
        <p className="font-sans text-sm text-stone-500">
          Sign in to your notebook
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block font-sans text-sm text-stone-600"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 font-sans text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block font-sans text-sm text-stone-600"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 font-sans text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        {error && <p className="font-sans text-sm text-rose-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-stone-900 px-4 py-2.5 font-sans text-sm text-stone-50 hover:bg-stone-800 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center font-sans text-sm text-stone-500">
        No account?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="text-stone-800 underline hover:text-stone-900"
        >
          Register here
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-stone-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
