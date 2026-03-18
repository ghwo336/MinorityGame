"use client";

import { useGamesListApi } from "@/hooks/useGameApi";
import GameCard from "./GameCard";
import Link from "next/link";
import { MOCK_GAMES } from "@/lib/mockGames";

function MockGameCard({ game, index }: { game: (typeof MOCK_GAMES)[number]; index: number }) {
  const percentA = 35 + ((index * 17) % 30);
  const percentB = 100 - percentA;

  return (
    <Link href={`/games/${index}`}>
      <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all p-4 h-full cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">
            {game.question}
          </h3>
          <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full shrink-0 ml-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Live
          </span>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 rounded-lg py-2 px-3 text-center border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">{game.optionA}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{percentA}%</div>
          </div>
          <div className="flex-1 rounded-lg py-2 px-3 text-center border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">{game.optionB}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{percentB}%</div>
          </div>
        </div>

        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex mb-3">
          <div className="bg-[#0052ff] rounded-l-full" style={{ width: `${percentA}%` }} />
          <div className="bg-red-400 rounded-r-full" style={{ width: `${percentB}%` }} />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-3">
            <span>{game.pool} ETH pool</span>
            <span>{game.voters} voters</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

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

  // API 에러 또는 데이터 없음: 목 데이터 표시
  if (error || !data || data.total === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Preview markets — deploy the contract to enable voting
          </p>
          <Link href="/games/create">
            <button className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0052ff] hover:bg-[#0047e0] rounded-lg transition-colors">
              Create market
            </button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_GAMES.map((game, i) => (
            <MockGameCard key={i} game={game} index={i} />
          ))}
        </div>
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
