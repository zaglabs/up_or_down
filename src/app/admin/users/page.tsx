"use client";

import useSWR from "swr";
import { useAppStore } from "@/store/app-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";
import type { AIProviderName } from "@/lib/ai/providers";

const AI_PROVIDERS: Array<{ id: AIProviderName; label: string; envVar: string; description: string }> = [
  { id: "anthropic", label: "Anthropic Claude", envVar: "ANTHROPIC_API_KEY", description: "Claude 3 Opus / Sonnet" },
  { id: "openai", label: "OpenAI GPT", envVar: "OPENAI_API_KEY", description: "GPT-4 / GPT-4 Turbo" },
  { id: "deepseek", label: "DeepSeek", envVar: "DEEPSEEK_API_KEY", description: "DeepSeek-V2" },
  { id: "kimi", label: "Kimi (Moonshot)", envVar: "KIMI_API_KEY", description: "Kimi-128K" },
  { id: "grok", label: "xAI Grok", envVar: "GROK_API_KEY", description: "Grok-2" },
  { id: "gemini", label: "Google Gemini", envVar: "GEMINI_API_KEY", description: "Gemini 1.5 Pro" },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminUsersPage() {
  const { activeProvider, setActiveProvider } = useAppStore();
  const { data: status } = useSWR("/api/admin/status", fetcher, { revalidateOnFocus: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">User Management</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage AI provider configuration. Switch the active provider and verify API key status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
          <p className="text-xs text-zinc-500">
            Click a provider to make it active. The green indicator shows whether the corresponding
            API key is configured in the server environment.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {AI_PROVIDERS.map(({ id, label, envVar, description }) => {
            const isActive = activeProvider === id;
            const isConfigured = status?.providers?.[id] === true;

            return (
              <button
                key={id}
                onClick={() => setActiveProvider(id)}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  isActive
                    ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-medium">{label}</span>
                      <span className="ml-2 text-xs text-zinc-600">{description}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden font-mono text-xs text-zinc-600 sm:block">{envVar}</span>
                    {status ? (
                      isConfigured ? (
                        <CheckCircle size={14} className="text-emerald-400" />
                      ) : (
                        <XCircle size={14} className="text-zinc-600" />
                      )
                    ) : (
                      <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-zinc-700" />
                    )}
                    {isActive && (
                      <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-200">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-400">
          <p>
            This application is single-user and has no built-in authentication. Anyone with access to
            the deployment URL has full access to all features.
          </p>
          <p>
            To restrict access, enable{" "}
            <span className="text-zinc-300">Vercel Password Protection</span> or{" "}
            <span className="text-zinc-300">Vercel SSO</span> in your project settings under the
            Security tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
