"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  usePendingWithdrawals,
  useWithdrawPendingFees,
  useEmergencyRefund,
} from "@/hooks/useGameContract";
import { usePlayerGamesApi } from "@/hooks/useGameApi";
import { formatETH } from "@/lib/utils";
import type { GameData } from "@/lib/api";
import ClaimButton from "@/components/ClaimButton";
import Link from "next/link";

export default function MyPage() {
  const { address, isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 p-12">
          <div className="text-4xl mb-4">&#x1F4BC;</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Portfolio</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Connect your wallet to view your positions</p>
        </div>
      </div>
    );
  }

  return <MyGames address={address!} />;
}

function MyGames({ address }: { address: `0x${string}` }) {
  const { data: playerData, isLoading } = usePlayerGamesApi(address);
  const { data: pendingFees } = usePendingWithdrawals(address);
  const {
    withdraw,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    isSuccess: isWithdrawSuccess,
  } = useWithdrawPendingFees();

  const hasPendingFees = pendingFees !== undefined && pendingFees > 0n;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Portfolio</h1>

      {/* Creator Fees */}
      {hasPendingFees && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">Creator fees available</div>
              <div className="text-lg font-bold text-green-700 dark:text-green-400">{formatETH(pendingFees!)} ETH</div>
            </div>
            <button
              onClick={withdraw}
              disabled={isWithdrawPending || isWithdrawConfirming || isWithdrawSuccess}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isWithdrawSuccess ? "Done!" : isWithdrawPending ? "Confirm..." : isWithdrawConfirming ? "Processing..." : "Withdraw"}
            </button>
          </div>
        </div>
      )}

      {/* Positions */}
      <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="grid grid-cols-4 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <span>Market</span>
            <span>Position</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Loading positions...</div>
        ) : !playerData || playerData.positions.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">No positions yet</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {playerData.positions.map((pos) => (
              <MyGameRow
                key={pos.gameId}
                gameId={pos.gameId}
                choice={pos.choice}
                hasClaimed={pos.hasClaimed}
                game={pos.game}
                address={address}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const EMERGENCY_REFUND_DELAY = 3 * 24 * 60 * 60; // 3 days in seconds

function EmergencyRefundButton({ gameId }: { gameId: number }) {
  const { emergencyRefund, isPending, isConfirming, isSuccess, error } = useEmergencyRefund();

  if (isSuccess) return <span className="text-xs text-green-600 dark:text-green-400">Refunded!</span>;

  return (
    <button
      onClick={() => emergencyRefund(gameId)}
      disabled={isPending || isConfirming}
      className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
    >
      {isPending ? "Confirm..." : isConfirming ? "Processing..." : "Emergency Refund"}
    </button>
  );
}

function MyGameRow({
  gameId,
  choice,
  hasClaimed,
  game,
  address,
}: {
  gameId: number;
  choice: number;
  hasClaimed: boolean;
  game: GameData;
  address: `0x${string}`;
}) {
  const isResolved = game.status === 1;

  // DB에 choice가 없으면 localStorage에서 복원 (백엔드 POST 실패 등 fallback)
  const [localChoice, setLocalChoice] = useState(0);
  useEffect(() => {
    if (choice !== 0) return;
    const saved = localStorage.getItem(`minority_vote_choice_${gameId}_${address.toLowerCase()}`);
    if (saved === "1" || saved === "2") setLocalChoice(Number(saved));
  }, [gameId, address, choice]);

  const displayChoice = choice !== 0 ? choice : localChoice;

  let claimableAmount = 0n;
  if (!hasClaimed && isResolved) {
    if (game.isTie || displayChoice === game.winningChoice) {
      claimableAmount = game.payoutPerPlayer;
    }
  }

  const canClaim = claimableAmount > 0n;
  const isWinner = isResolved && !game.isTie && displayChoice !== 0 && displayChoice === game.winningChoice;
  const isLoser = isResolved && !game.isTie && displayChoice !== 0 && displayChoice !== game.winningChoice;

  const nowSec = Math.floor(Date.now() / 1000);
  const gameEnd = Number(game.startTime) + Number(game.duration);
  const canEmergencyRefund =
    !isResolved &&
    !hasClaimed &&
    nowSec >= gameEnd + EMERGENCY_REFUND_DELAY;

  return (
    <div className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="grid grid-cols-4 items-center">
        <Link href={`/games/${gameId}`} className="text-sm font-medium text-[#0052ff] hover:underline line-clamp-2">
          {game.question || `Game #${gameId}`}
        </Link>

        {displayChoice === 0 ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-400 dark:text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Hidden
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${
            displayChoice === 1 ? "text-[#0052ff]" : "text-red-500"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              displayChoice === 1 ? "bg-[#0052ff]" : "bg-red-500"
            }`} />
            {displayChoice === 1 ? (game.optionA || "A") : (game.optionB || "B")}
          </span>
        )}

        <div>
          {!isResolved && nowSec < gameEnd && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Live
            </span>
          )}
          {!isResolved && nowSec >= gameEnd && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
              Pending
            </span>
          )}
          {isResolved && game.isTie && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">Draw</span>
          )}
          {isWinner && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Won</span>
          )}
          {isLoser && (
            <span className="text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Lost</span>
          )}
        </div>

        <div className="text-right">
          {canClaim ? (
            <div className="w-32 ml-auto">
              <ClaimButton gameId={gameId} amount={claimableAmount} />
            </div>
          ) : canEmergencyRefund ? (
            <EmergencyRefundButton gameId={gameId} />
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatETH(game.totalPool)} ETH pool
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
