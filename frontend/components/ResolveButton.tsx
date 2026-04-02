"use client";

import { useState } from "react";
import { resolveGame } from "@/lib/api";

interface ResolveButtonProps {
  gameId: number;
  onResolved?: () => void;
}

export default function ResolveButton({ gameId, onResolved }: ResolveButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleResolve() {
    setStatus("loading");
    setErrorMsg("");
    try {
      await resolveGame(gameId);
      setStatus("done");
      onResolved?.();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resolve");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-center justify-center gap-2 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Resolution submitted! Refreshing...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleResolve}
        disabled={status === "loading"}
        className="w-full py-3 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === "loading" ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Resolving...
          </>
        ) : (
          "Resolve Game"
        )}
      </button>
      {status === "error" && (
        <p className="text-center text-xs text-red-500 dark:text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
