"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [mockCode, setMockCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to send code");
      return;
    }
    const { token, code } = await res.json();
    setOtpToken(token);
    setMockCode(code);
    setStep("otp");
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      code: enteredCode,
      token: otpToken,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid or expired code. Try again.");
    } else {
      router.push(callbackUrl);
    }
  };

  if (step === "otp") {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-4">
        <p className="text-sm text-zinc-400 text-center">
          Code for <span className="text-zinc-200">{email}</span>
        </p>

        {/* Mock display — remove once real email delivery is wired up */}
        <div className="rounded-lg border border-dashed border-zinc-600 bg-zinc-800/50 px-4 py-4 text-center">
          <p className="text-xs text-zinc-500 mb-2">Your one-time code</p>
          <p className="text-4xl font-mono font-bold tracking-[0.25em] text-emerald-400">
            {mockCode}
          </p>
          <p className="text-xs text-zinc-600 mt-2">Mock mode — would be sent via email</p>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1">Enter code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={enteredCode}
            onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-center font-mono text-xl tracking-[0.3em] text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            placeholder="000000"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || enteredCode.length !== 6}
          className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50 transition-colors"
        >
          {loading ? "Verifying…" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError("");
            setMockCode("");
            setEnteredCode("");
            setOtpToken("");
          }}
          className="w-full text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleEmailSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50 transition-colors"
      >
        {loading ? "Sending code…" : "Send code"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-100">UpOrDown</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to your account</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
