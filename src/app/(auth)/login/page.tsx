"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [step, setStep] = useState<"email" | "otp" | "pending">("email");
  const [email, setEmail] = useState("");
  const [mockCode, setMockCode] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.status === 202 && data.pending) {
        setStep("pending");
      } else if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setMockCode(data.code);
        setStep("otp");
      }
    } catch {
      setError("Could not reach server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, code, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect code. Try again.");
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <span className="text-2xl">▲▼</span>
          <span className="text-xl font-bold text-zinc-100">UpOrDown</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {step === "email" ? "Sign in" : step === "otp" ? "Check your email" : "Request received"}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {step === "email"
            ? "Enter your email to receive a one-time code"
            : step === "otp"
            ? `We sent a code to ${email}`
            : "An admin will review and approve your account"}
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-4">
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
            {loading ? "Sending…" : "Send code"}
          </button>
          <p className="text-center text-xs text-zinc-600">
            Don&apos;t have access?{" "}
            <Link href="/register" className="text-zinc-400 hover:text-zinc-200">
              Request access
            </Link>
          </p>
        </form>
      ) : step === "pending" ? (
        <div className="space-y-4 text-center">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-sm text-zinc-300 font-medium">Access request submitted</p>
            <p className="mt-2 text-xs text-zinc-500">
              We&apos;ve noted your request for <span className="text-zinc-400">{email}</span>.
              You&apos;ll be able to sign in once an admin approves your account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setStep("email"); setEmail(""); setError(""); }}
            className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
          >
            ← Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          {/* Mock: shows code on screen until real email delivery is wired up */}
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-4 text-center">
            <p className="text-xs text-zinc-500 mb-2">Your code (mock — normally sent by email)</p>
            <p className="text-3xl font-mono font-bold tracking-[0.3em] text-emerald-400">{mockCode}</p>
          </div>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
            placeholder="000000"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-zinc-100 placeholder-zinc-700 focus:border-zinc-600 focus:outline-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("email"); setCode(""); setError(""); setMockCode(""); }}
            className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
          >
            ← Use a different email
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
