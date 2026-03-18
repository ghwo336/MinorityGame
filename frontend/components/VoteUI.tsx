"use client";

import { useState } from "react";
import { useJoinGame } from "@/hooks/useGameContract";
import { useRefetchAfterTx } from "@/hooks/useGameApi";

interface VoteUIProps {
  gameId: number;
  countA: bigint;
  countB: bigint;
  disabled: boolean;
  playerChoice: number;
  labelA?: string;
  labelB?: string;
}

export default function VoteUI({
  gameId,
  countA,
  countB,
  disabled,
  playerChoice,
  labelA = "A",
  labelB = "B",
}: VoteUIProps) {
  const [selected, setSelected] = useState<1 | 2 | null>(null);
  const { join, isPending, isConfirming, hash } = useJoinGame();
  useRefetchAfterTx(hash);

  const totalVotes = Number(countA) + Number(countB);
  const percentA = totalVotes > 0 ? Math.round((Number(countA) / totalVotes) * 100) : 50;
  const percentB = 100 - percentA;
  const isVoting = isPending || isConfirming;
  const alreadyVoted = playerChoice !== 0;

  function handleSelect(choice: 1 | 2) {
    if (alreadyVoted || isVoting) return;
    setSelected(selected === choice ? null : choice);
  }

  function handleConfirm() {
    if (!selected || alreadyVoted || isVoting) return;
    join(gameId, selected);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Make your prediction</h3>

      {/* Outcome buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* Choice A */}
        <button
          onClick={() => handleSelect(1)}
          disabled={alreadyVoted || isVoting}
          className={`relative rounded-xl p-4 border-2 transition-all
            ${
              playerChoice === 1
                ? "border-[#0052ff] bg-blue-50 dark:bg-blue-900/20 ring-1 ring-[#0052ff]/20"
                : selected === 1
                ? "border-[#0052ff] bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-[#0052ff]/20"
                : alreadyVoted
                ? "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161b22] hover:border-[#0052ff] hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer"
            }
          `}
        >
          {(playerChoice === 1 || selected === 1) && (
            <div className="absolute top-2 right-2">
              <svg className="w-5 h-5 text-[#0052ff]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <div className="text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{labelA}</div>
            <div className={`text-3xl font-bold ${
              playerChoice === 1 || selected === 1 ? "text-[#0052ff]" : "text-gray-900 dark:text-white"
            }`}>
              {percentA}%
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{countA.toString()} votes</div>
          </div>
        </button>

        {/* Choice B */}
        <button
          onClick={() => handleSelect(2)}
          disabled={alreadyVoted || isVoting}
          className={`relative rounded-xl p-4 border-2 transition-all
            ${
              playerChoice === 2
                ? "border-red-500 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-500/20"
                : selected === 2
                ? "border-red-500 bg-red-50/50 dark:bg-red-900/10 ring-1 ring-red-500/20"
                : alreadyVoted
                ? "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161b22] hover:border-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/10 cursor-pointer"
            }
          `}
        >
          {(playerChoice === 2 || selected === 2) && (
            <div className="absolute top-2 right-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <div className="text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{labelB}</div>
            <div className={`text-3xl font-bold ${
              playerChoice === 2 || selected === 2 ? "text-red-500" : "text-gray-900 dark:text-white"
            }`}>
              {percentB}%
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{countB.toString()} votes</div>
          </div>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
        <div
          className="bg-[#0052ff] transition-all duration-500"
          style={{ width: `${percentA}%` }}
        />
        <div
          className="bg-red-400 transition-all duration-500"
          style={{ width: `${percentB}%` }}
        />
      </div>

      {/* Confirm button */}
      {selected && !alreadyVoted && !isVoting && (
        <button
          onClick={handleConfirm}
          className={`w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors ${
            selected === 2
              ? "bg-red-500 hover:bg-red-600"
              : "bg-[#0052ff] hover:bg-[#0047e0]"
          }`}
        >
          &ldquo;{selected === 1 ? labelA : labelB}&rdquo; 선택하기 (0.001 ETH)
        </button>
      )}

      {/* Voting status */}
      {isVoting && (
        <div className="flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <svg className="animate-spin h-4 w-4 text-[#0052ff]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-[#0052ff] font-medium">
            {isPending ? "Confirm in wallet..." : "Processing..."}
          </span>
        </div>
      )}

      {/* Entry fee note */}
      {!selected && !alreadyVoted && !isVoting && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Entry fee: 0.001 ETH per vote
        </p>
      )}
    </div>
  );
}
