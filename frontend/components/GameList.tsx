"use client";

import { useGamesListApi } from "@/hooks/useGameApi";
import GameCard from "./GameCard";
import Link from "next/link";

export default function GameList({ status }: { status?: number }) {
  const { data, isLoading, error } = useGamesListApi({ status });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
            <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-2/3 mb-3" />
            <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded mb-3" />
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
        Failed to load markets. Please try again later.
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No markets yet.</p>
        <Link href="/games/create">
          <button className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0052ff] hover:bg-[#0047e0] rounded-lg transition-colors">
            Create market
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.games.map((game) => (
        <GameCard key={game.gameId} gameId={game.gameId} game={game} />
      ))}
    </div>
  );
}
