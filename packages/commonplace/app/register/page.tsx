"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? "/write";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Supabase returns a user with an empty identities array when the email
    // is already registered (to avoid leaking account existence).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("An account with this email already exists. Try signing in.");
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, a session is created immediately.
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }

    // Otherwise the user must confirm via the emailed link.
    setConfirmSent(true);
    setLoading(false);
  }

  if (confirmSent) {
    return (
      <div className="mx-auto max-w-sm space-y-6 py-10 text-center">
        <h1 className="font-display text-4xl text-stone-900">Confirm your email</h1>
        <p className="rounded border border-stone-300 bg-stone-100 p-4 font-sans text-sm text-stone-700">
          We sent a confirmation link to <strong>{email}</strong>. Open it to
          finish setting up your notebook.
        </p>
        <p className="font-sans text-sm text-stone-500">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="text-stone-800 underline hover:text-stone-900"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-8 py-10">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-4xl text-stone-900">Commonplace</h1>
        <p className="font-sans text-sm text-stone-500">
          Create your notebook
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 font-sans text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirm"
            className="block font-sans text-sm text-stone-600"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center font-sans text-sm text-stone-500">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-stone-800 underline hover:text-stone-900"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-stone-500">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
