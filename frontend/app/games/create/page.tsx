"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useCreateGame, useGameCount } from "@/hooks/useGameContract";
import Link from "next/link";

export default function CreateGamePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { create, isPending, isConfirming, isSuccess, error } = useCreateGame();
  const { data: gameCount } = useGameCount();

  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(86400);
  const [pendingGameId, setPendingGameId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const isFormValid = question.trim().length > 0 && optionA.trim().length > 0 && optionB.trim().length > 0;

  useEffect(() => {
    if (isSuccess && pendingGameId !== null) {
      setShowSuccess(true);
    }
  }, [isSuccess, pendingGameId]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      {/* Create Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Market Created!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Your game has been successfully created.</p>
            <button
              onClick={() => {
                setShowSuccess(false);
                if (pendingGameId !== null) router.push(`/games/${pendingGameId}`);
              }}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#0052ff] hover:bg-[#0047e0] rounded-lg transition-colors"
            >
              Go to Game
            </button>
          </div>
        </div>
      )}
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-6">
        &larr; Back
      </Link>

      <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create a new market</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set your question and two choices. Minority wins.
          </p>
        </div>

        {/* Question input */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Will ETH hit $5k this month?"
              className="w-full px-4 py-3 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0052ff]/30 focus:border-[#0052ff] transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Duration
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "1m", seconds: 60 },
                { label: "5m", seconds: 300 },
                { label: "1d", seconds: 86400 },
                { label: "3d", seconds: 259200 },
                { label: "7d", seconds: 604800 },
              ].map(({ label, seconds }) => (
                <button
                  key={seconds}
                  type="button"
                  onClick={() => setDurationSeconds(seconds)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    durationSeconds === seconds
                      ? "border-[#0052ff] bg-blue-50 dark:bg-blue-900/20 text-[#0052ff]"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Option A
              </label>
              <input
                type="text"
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
                placeholder="e.g. Yes"
                className="w-full px-4 py-3 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0052ff]/30 focus:border-[#0052ff] transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Option B
              </label>
              <input
                type="text"
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
                placeholder="e.g. No"
                className="w-full px-4 py-3 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0052ff]/30 focus:border-[#0052ff] transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        {isFormValid && (
          <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Preview
            </div>
            <div className="mb-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{question}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#0052ff]/30 bg-blue-50/50 dark:bg-blue-900/10 p-4 text-center">
                <div className="text-lg font-bold text-[#0052ff]">{optionA}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Option A</div>
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-50/50 dark:bg-red-900/10 p-4 text-center">
                <div className="text-lg font-bold text-red-500">{optionB}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Option B</div>
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Creation fee</span>
            <span className="font-medium text-gray-900 dark:text-white">0.003 ETH</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Duration</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {durationSeconds < 3600
                ? `${durationSeconds / 60}m`
                : durationSeconds < 86400
                ? `${durationSeconds / 3600}h`
                : `${durationSeconds / 86400}d`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Entry fee (per player)</span>
            <span className="font-medium text-gray-900 dark:text-white">0.003 ETH</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Creator reward</span>
            <span className="font-medium text-green-600 dark:text-green-400">9% of pool</span>
          </div>
        </div>

        {/* Action */}
        <div className="p-6">
          {!isConnected ? (
            <div className="text-center py-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Connect wallet to create a market</span>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!question.trim()) return alert("Please enter a question for your market.");
                if (!optionA.trim()) return alert("Please enter a label for Option A.");
                if (!optionB.trim()) return alert("Please enter a label for Option B.");
                if (gameCount !== undefined) setPendingGameId(Number(gameCount));
                create(question.trim(), optionA.trim(), optionB.trim(), durationSeconds);
              }}
              disabled={isPending || isConfirming}
              className="w-full py-3 text-sm font-semibold text-white bg-[#0052ff] hover:bg-[#0047e0] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending || isConfirming ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isPending ? "Confirm in wallet..." : "Creating..."}
                </>
              ) : (
                "Create market (0.003 ETH)"
              )}
            </button>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {(error as Error).message?.slice(0, 100)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
