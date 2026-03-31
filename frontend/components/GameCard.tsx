"use client";

import Link from "next/link";
import type { GameData } from "@/lib/api";
import { formatETH, shortenAddress } from "@/lib/utils";
import CountdownTimer from "./CountdownTimer";

interface GameCardProps {
  gameId: number;
  game: GameData;
}

export default function GameCard({ gameId, game }: GameCardProps) {
  const totalVotes = Number(game.countA) + Number(game.countB);
  const percentA = totalVotes > 0 ? Math.round((Number(game.countA) / totalVotes) * 100) : 50;
  const percentB = 100 - percentA;
  const isActive = game.status === 0;
  const isResolved = game.status === 1;
  const isExpired = Number(game.startTime) + Number(game.duration) <= Math.floor(Date.now() / 1000);
  const isNoParticipantEnded = isActive && isExpired && game.commitCount === 0;

  return (
    <Link href={`/games/${gameId}`}>
      <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all p-4 cursor-pointer h-full flex flex-col">
        {/* Title row */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1">
            {game.question || `Game #${gameId}`}
          </h3>
          {isActive && !isNoParticipantEnded && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          {isNoParticipantEnded && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full shrink-0">
              Ended
            </span>
          )}
          {isResolved && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full shrink-0">
              {game.isTie ? "Draw" : "Resolved"}
            </span>
          )}
        </div>

        {/* Outcome buttons */}
        <div className="flex gap-2 mb-3 flex-1">
          {isResolved ? (
            <>
              <div className={`flex-1 rounded-lg py-2.5 px-3 text-center border ${
                !game.isTie && game.winningChoice === 1
                  ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30"
                  : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              }`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">{game.optionA || "A"}</div>
                <div className={`text-lg font-bold ${
                  !game.isTie && game.winningChoice === 1
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-900 dark:text-white"
                }`}>
                  {percentA}%
                </div>
              </div>
              <div className={`flex-1 rounded-lg py-2.5 px-3 text-center border ${
                !game.isTie && game.winningChoice === 2
                  ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30"
                  : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              }`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">{game.optionB || "B"}</div>
                <div className={`text-lg font-bold ${
                  !game.isTie && game.winningChoice === 2
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-900 dark:text-white"
                }`}>
                  {percentB}%
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 rounded-lg py-3 px-3 text-center border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{game.optionA || "A"}</span>
              </div>
              <div className="flex-1 rounded-lg py-3 px-3 text-center border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{game.optionB || "B"}</span>
              </div>
            </>
          )}
        </div>

        {/* Progress bar - resolved only */}
        {isResolved && (
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex mb-3">
            <div
              className="bg-[#0052ff] transition-all duration-500 rounded-l-full"
              style={{ width: `${percentA}%` }}
            />
            <div
              className="bg-red-400 transition-all duration-500 rounded-r-full"
              style={{ width: `${percentB}%` }}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-auto pt-1">
          <div className="flex items-center gap-3">
            <span>{formatETH(game.totalPool)} ETH pool</span>
            {isActive && !isNoParticipantEnded ? (
              <span>{game.commitCount} {game.commitCount === 1 ? "vote" : "votes"}</span>
            ) : isResolved ? (
              <span>{totalVotes} voters</span>
            ) : null}
          </div>
          <div>
            {isActive && !isNoParticipantEnded ? (
              <CountdownTimer startTime={game.startTime} duration={game.duration} compact />
            ) : isNoParticipantEnded ? (
              <span>No participants</span>
            ) : (
              <span>{shortenAddress(game.creator)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
