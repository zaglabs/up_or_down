"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSetup = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/setup");
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? data.detail ?? "Setup failed");
      } else {
        setStatus("done");
        setMessage(data.message);
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch {
      setStatus("error");
      setMessage("Network error — please try again");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">UpOrDown Setup</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Initialize the database and create the admin account.
            <br />Only needs to be run once.
          </p>
        </div>

        {status === "idle" && (
          <button
            onClick={handleSetup}
            className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-white transition-colors"
          >
            Initialize
          </button>
        )}

        {status === "loading" && (
          <p className="text-sm text-zinc-400">Setting up database…</p>
        )}

        {status === "done" && (
          <div className="space-y-2">
            <p className="text-sm text-emerald-400">{message}</p>
            <p className="text-xs text-zinc-500">Redirecting to login…</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-red-400">{message}</p>
            <button
              onClick={() => setStatus("idle")}
              className="text-xs text-zinc-500 hover:text-zinc-400"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
