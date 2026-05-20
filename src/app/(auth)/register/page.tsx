"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [step, setStep] = useState<"form" | "done">("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setStep("done");
      }
    } catch {
      setError("Could not reach server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl">▲▼</span>
            <span className="text-xl font-bold text-zinc-100">UpOrDown</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Request access</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Submit your email and an admin will approve your account.
          </p>
        </div>

        {step === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@example.com"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
            >
              {loading ? "Submitting…" : "Request access"}
            </button>
            <p className="text-center text-xs text-zinc-600">
              Already have access?{" "}
              <Link href="/login" className="text-zinc-400 hover:text-zinc-200">
                Sign in
              </Link>
            </p>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="text-4xl">✓</div>
            <p className="text-zinc-100 font-medium">Request submitted!</p>
            <p className="text-sm text-zinc-500">
              We&apos;ll notify you at <span className="text-zinc-300">{email}</span> once your account is approved.
            </p>
            <Link href="/login" className="block text-xs text-zinc-500 hover:text-zinc-400 mt-4">
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
