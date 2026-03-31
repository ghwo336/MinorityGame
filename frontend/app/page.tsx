"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GameList from "@/components/GameList";
import { useGamesListApi } from "@/hooks/useGameApi";

type Tab = "active" | "ended";

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("active");
  const [autoSwitched, setAutoSwitched] = useState(false);
  const { data: activeData, isLoading } = useGamesListApi({ status: 0 });

  useEffect(() => {
    if (!isLoading && !autoSwitched && activeData?.total === 0) {
      setTab("ended");
      setAutoSwitched(true);
    }
  }, [isLoading, activeData, autoSwitched]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Hero */}
      <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 p-8 mb-6">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            On-chain prediction market
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Pick the minority side. Fewer wins more.
            No oracles needed &mdash; pure on-chain consensus.
          </p>
          <Link href="/games/create">
            <button className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0052ff] hover:bg-[#0047e0] rounded-lg transition-colors">
              Create market
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Entry fee</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">0.001 ETH</div>
        </div>
        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Winner share</div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">90%</div>
        </div>
        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Duration</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">24h</div>
        </div>
      </div>

      {/* Markets */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Markets</h2>
        <div className="flex gap-2">
          {(["active", "ended"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                tab === t
                  ? "text-[#0052ff] bg-blue-50 dark:bg-blue-900/30"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {t === "active" ? "Active" : "Ended"}
            </button>
          ))}
        </div>
      </div>

      <GameList status={tab === "active" ? 0 : 1} />
    </div>
  );
}
