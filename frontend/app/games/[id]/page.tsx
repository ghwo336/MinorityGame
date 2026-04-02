"use client";

import { use } from "react";
import { useAccount } from "wagmi";
import { useGameDataApi, usePlayerStatusApi } from "@/hooks/useGameApi";
import { formatETH, shortenAddress } from "@/lib/utils";
import CountdownTimer from "@/components/CountdownTimer";
import VoteUI from "@/components/VoteUI";
import ClaimButton from "@/components/ClaimButton";
import ResolveButton from "@/components/ResolveButton";
import Link from "next/link";

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const gameId = parseInt(id);
  const { address } = useAccount();

  const { data: game, isLoading, error: gameError, refetch } = useGameDataApi(gameId);
  const { data: playerStatus } = usePlayerStatusApi(gameId, address);

  const playerChoice = playerStatus?.choice ?? 0;
  const hasCommitted = playerStatus?.hasCommitted ?? false;
  const claimableAmount = BigInt(playerStatus?.claimableAmount ?? "0");

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-gray-400 dark:text-gray-500 text-sm">Loading market...</div>
      </div>
    );
  }

  if (gameError || !game) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-4">
          &larr; Back to markets
        </Link>
        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Market not found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This market does not exist.</p>
          <Link href="/"><button className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0052ff] hover:bg-[#0047e0] rounded-lg transition-colors">Back to home</button></Link>
        </div>
      </div>
    );
  }

  const totalVotes = Number(game.countA) + Number(game.countB);
  const isActive = game.status === 0;
  const isResolved = game.status === 1;
  const displayVoters = isResolved ? totalVotes : game.commitCount;
  const hasVoted = hasCommitted || playerChoice !== 0;
  const isExpired =
    Number(game.startTime) + Number(game.duration) <= Math.floor(Date.now() / 1000);
  const isNoParticipantEnded = isActive && isExpired && game.commitCount === 0;
  const canVote = isActive && !isExpired && !hasVoted && !!address;
  const canClaim = claimableAmount > 0n;

  const estimatedReward = (() => {
    if (totalVotes === 0 || game.totalPool === 0n) return 0n;
    const winnerPool = (game.totalPool * 90n) / 100n;
    const biggerSide = game.countA > game.countB ? game.countA : game.countB;
    if (biggerSide === 0n) return 0n;
    return winnerPool / biggerSide;
  })();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-4"
      >
        &larr; Back to markets
      </Link>

      {/* Main Card */}
      <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-4">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {game.question || `Game #${gameId}`}
              </h1>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                by {shortenAddress(game.creator)}
              </p>
            </div>
            {isActive && !isExpired && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
            {isNoParticipantEnded && (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                Ended
              </span>
            )}
            {isActive && isExpired && !isNoParticipantEnded && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">
                Awaiting resolution
              </span>
            )}
            {isResolved && (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                {game.isTie ? "Draw" : "Resolved"}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 border-b border-gray-100 dark:border-gray-800">
          <div className="p-4 text-center">
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Pool</div>
            <div className="text-base font-bold text-gray-900 dark:text-white">
              {formatETH(game.totalPool)} ETH
            </div>
          </div>
          <div className="p-4 text-center">
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Voters</div>
            <div className="text-base font-bold text-gray-900 dark:text-white">{displayVoters}</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
              {isActive ? "Time left" : "Est. reward"}
            </div>
            <div className="text-base font-bold text-gray-900 dark:text-white">
              {isActive ? (
                <CountdownTimer startTime={game.startTime} duration={game.duration} compact />
              ) : totalVotes > 0 ? (
                `${formatETH(estimatedReward)} ETH`
              ) : (
                "-"
              )}
            </div>
          </div>
        </div>

        {/* Vote section */}
        <div className="p-6">
          <VoteUI
            gameId={gameId}
            countA={game.countA}
            countB={game.countB}
            commitCount={game.commitCount}
            disabled={!canVote}
            hasCommitted={hasCommitted}
            playerChoice={playerChoice ?? 0}
            labelA={game.optionA || "A"}
            labelB={game.optionB || "B"}
            address={address}
          />
        </div>
      </div>

      {/* No participants ended */}
      {isNoParticipantEnded && (
        <div className="mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-center text-sm text-gray-500 dark:text-gray-400">
          No one participated in this game.
        </div>
      )}

      {/* Resolve */}
      {isActive && isExpired && !isNoParticipantEnded && (
        <div className="mb-4">
          <ResolveButton gameId={gameId} onResolved={() => setTimeout(() => refetch(), 3000)} />
        </div>
      )}

      {/* Claim */}
      {isResolved && canClaim && (
        <div className="mb-4">
          <ClaimButton gameId={gameId} amount={claimableAmount} />
        </div>
      )}

      {/* Result */}
      {isResolved && (
        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Result</div>
          {game.isTie ? (
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">Draw - Refunds available</div>
          ) : (
            <div>
              <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-xl font-bold mb-2 ${
                game.winningChoice === 1
                  ? "bg-blue-50 dark:bg-blue-900/30 text-[#0052ff]"
                  : "bg-red-50 dark:bg-red-900/30 text-red-500"
              }`}>
                {game.winningChoice === 1 ? (game.optionA || "A") : (game.optionB || "B")}
              </span>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Payout: <span className="font-semibold text-gray-900 dark:text-white">{formatETH(game.payoutPerPlayer)} ETH</span> per winner
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
