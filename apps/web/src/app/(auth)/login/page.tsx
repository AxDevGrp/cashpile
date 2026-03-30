"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@cashpile/db/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">C</div>
            <span className="font-bold text-lg">Cashpile.ai</span>
          </Link>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-background rounded-xl border p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
            <input
              id="email" type="email" placeholder="you@example.com" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot password?</Link>
            </div>
            <input
              id="password" type="password" placeholder="••••••••" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
