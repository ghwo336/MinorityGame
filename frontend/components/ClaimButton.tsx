"use client";

import { useClaimReward } from "@/hooks/useGameContract";
import { useRefetchAfterTx } from "@/hooks/useGameApi";
import { formatETH } from "@/lib/utils";

interface ClaimButtonProps {
  gameId: number;
  amount: bigint;
}

export default function ClaimButton({ gameId, amount }: ClaimButtonProps) {
  const { claim, isPending, isConfirming, isSuccess } = useClaimReward();
  useRefetchAfterTx(isSuccess);

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-green-700 dark:text-green-400">Reward claimed!</span>
      </div>
    );
  }

  const isProcessing = isPending || isConfirming;

  return (
    <button
      onClick={() => claim(gameId)}
      disabled={isProcessing}
      className="w-full py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {isProcessing ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {isPending ? "Confirm in wallet..." : "Processing..."}
        </>
      ) : (
        <>Claim {formatETH(amount)} ETH</>
      )}
    </button>
  );
}
