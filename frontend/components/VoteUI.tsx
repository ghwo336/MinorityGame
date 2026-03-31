"use client";

import { useState, useEffect, useRef } from "react";
import { keccak256, encodePacked } from "viem";
import { useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { useCommitVote } from "@/hooks/useGameContract";
import { useRefetchAfterTx } from "@/hooks/useGameApi";
import { submitVoteData } from "@/lib/api";

interface VoteUIProps {
  gameId: number;
  countA: bigint;
  countB: bigint;
  commitCount: number;
  disabled: boolean;
  hasCommitted: boolean;
  playerChoice: number;   // 0 until game resolved
  labelA?: string;
  labelB?: string;
  address?: string;
}

const SALT_KEY = (gameId: number, address: string) => `minority_vote_salt_${gameId}_${address.toLowerCase()}`;
const CHOICE_KEY = (gameId: number, address: string) => `minority_vote_choice_${gameId}_${address.toLowerCase()}`;

export default function VoteUI({
  gameId,
  countA,
  countB,
  commitCount,
  disabled,
  hasCommitted,
  playerChoice,
  labelA = "A",
  labelB = "B",
  address,
}: VoteUIProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<1 | 2 | null>(null);
  const [localChoice, setLocalChoice] = useState<1 | 2 | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const { commit, isPending, isConfirming, isSuccess } = useCommitVote();
  const { signMessageAsync, isPending: isSignPending } = useSignMessage();
  const pendingSigRef = useRef<`0x${string}` | null>(null);
  useRefetchAfterTx(isSuccess);

  // localStorage에서 이전 투표 복원 (지갑별로 분리)
  useEffect(() => {
    setLocalChoice(null);
    if (!address) return;
    const saved = localStorage.getItem(CHOICE_KEY(gameId, address));
    if (saved === "1" || saved === "2") setLocalChoice(Number(saved) as 1 | 2);
  }, [gameId, address]);

  // tx 성공 후 백엔드에 choice+salt+signature 전송
  useEffect(() => {
    if (!isSuccess || !address || !selected) return;

    const salt = localStorage.getItem(SALT_KEY(gameId, address));
    const sig = pendingSigRef.current;
    if (!salt || !sig) return;

    submitVoteData(gameId, address, selected, salt, sig)
      .then(() => {
        localStorage.setItem(CHOICE_KEY(gameId, address), String(selected));
        setLocalChoice(selected);
        setShowSuccess(true);
      })
      .catch((err) => {
        console.error("Failed to store vote data:", err);
        localStorage.setItem(CHOICE_KEY(gameId, address), String(selected));
        setLocalChoice(selected);
        setShowSuccess(true);
      });
  }, [isSuccess]);

  const isVoting = isSignPending || isPending || isConfirming;
  const alreadyVoted = hasCommitted || playerChoice !== 0;
  const isResolved = playerChoice !== 0;

  const totalVotes = isResolved ? Number(countA) + Number(countB) : 0;
  const percentA = totalVotes > 0 ? Math.round((Number(countA) / totalVotes) * 100) : 50;
  const percentB = 100 - percentA;

  const myChoice = isResolved ? playerChoice : (localChoice ?? (alreadyVoted ? (hasCommitted ? 0 : playerChoice) : 0));

  function handleSelect(choice: 1 | 2) {
    if (alreadyVoted || isVoting) return;
    setSelected(selected === choice ? null : choice);
  }

  async function handleConfirm() {
    if (!selected || alreadyVoted || isVoting) return;
    if (!address) {
      alert("Please connect your wallet first.");
      return;
    }

    const saltBytes = crypto.getRandomValues(new Uint8Array(32));
    const salt = `0x${Array.from(saltBytes).map((b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
    localStorage.setItem(SALT_KEY(gameId, address), salt);

    const commitment = keccak256(
      encodePacked(
        ["uint256", "uint8", "bytes32", "address"],
        [BigInt(gameId), selected, salt, address as `0x${string}`]
      )
    );

    try {
      // 1) 지갑 서명 (gasless)
      const sig = await signMessageAsync({
        message: `minority-commit:${gameId}:${commitment}`,
      });
      pendingSigRef.current = sig;

      // 2) 온체인 commitment 제출
      commit(gameId, commitment);
    } catch {
      localStorage.removeItem(SALT_KEY(gameId, address));
      pendingSigRef.current = null;
    }
  }

  return (
    <>
    {/* Success Modal */}
    {showSuccess && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-xl max-w-sm w-full mx-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Vote Submitted!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Your vote has been recorded. Results will be revealed when the game ends.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push("/")}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#0052ff] hover:bg-[#0047e0] rounded-lg transition-colors"
            >
              Back to markets
            </button>
            <button
              onClick={() => setShowSuccess(false)}
              className="w-full py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Stay on this page
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {isResolved ? "Result" : "Make your prediction"}
        </h3>
        {!isResolved && commitCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {commitCount} {commitCount === 1 ? "vote" : "votes"} · results hidden
          </span>
        )}
      </div>

      {/* Vote buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* Choice A */}
        <button
          onClick={() => handleSelect(1)}
          disabled={alreadyVoted || isVoting}
          className={`relative rounded-xl px-4 py-7 border-2 transition-all flex flex-col items-center justify-center gap-1
            ${myChoice === 1
              ? "border-[#0052ff] bg-blue-50 dark:bg-blue-900/20 ring-1 ring-[#0052ff]/20"
              : selected === 1
              ? "border-[#0052ff] bg-blue-50/50 dark:bg-blue-900/10"
              : alreadyVoted
              ? "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161b22] hover:border-[#0052ff] hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer"
            }`}
        >
          {(myChoice === 1 || selected === 1) && (
            <div className="absolute top-2.5 right-2.5">
              <svg className="w-4 h-4 text-[#0052ff]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <span className={`text-2xl font-bold leading-tight text-center line-clamp-2 ${
            myChoice === 1 || selected === 1 ? "text-[#0052ff]" : "text-gray-900 dark:text-white"
          }`}>
            {labelA}
          </span>
          {isResolved && (
            <span className={`text-sm font-semibold ${
              myChoice === 1 ? "text-[#0052ff]" : "text-gray-500 dark:text-gray-400"
            }`}>
              {percentA}%
            </span>
          )}
        </button>

        {/* Choice B */}
        <button
          onClick={() => handleSelect(2)}
          disabled={alreadyVoted || isVoting}
          className={`relative rounded-xl px-4 py-7 border-2 transition-all flex flex-col items-center justify-center gap-1
            ${myChoice === 2
              ? "border-red-500 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-500/20"
              : selected === 2
              ? "border-red-500 bg-red-50/50 dark:bg-red-900/10"
              : alreadyVoted
              ? "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161b22] hover:border-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/10 cursor-pointer"
            }`}
        >
          {(myChoice === 2 || selected === 2) && (
            <div className="absolute top-2.5 right-2.5">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <span className={`text-2xl font-bold leading-tight text-center line-clamp-2 ${
            myChoice === 2 || selected === 2 ? "text-red-500" : "text-gray-900 dark:text-white"
          }`}>
            {labelB}
          </span>
          {isResolved && (
            <span className={`text-sm font-semibold ${
              myChoice === 2 ? "text-red-500" : "text-gray-500 dark:text-gray-400"
            }`}>
              {percentB}%
            </span>
          )}
        </button>
      </div>

      {/* Progress bar - resolved only */}
      {isResolved && (
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
          <div className="bg-[#0052ff] transition-all duration-500" style={{ width: `${percentA}%` }} />
          <div className="bg-red-400 transition-all duration-500" style={{ width: `${percentB}%` }} />
        </div>
      )}

      {/* Confirm button */}
      {selected && !alreadyVoted && !isVoting && (
        <button
          onClick={handleConfirm}
          className={`w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors ${
            selected === 2 ? "bg-red-500 hover:bg-red-600" : "bg-[#0052ff] hover:bg-[#0047e0]"
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
            {isSignPending ? "Sign message in wallet..." : isPending ? "Confirm transaction..." : "Processing..."}
          </span>
        </div>
      )}

      {/* Status messages */}
      {alreadyVoted && !isVoting && !isResolved && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Vote submitted · Results revealed after game ends
        </p>
      )}
      {!selected && !alreadyVoted && !isVoting && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Entry fee: 0.001 ETH · Results hidden until game ends
        </p>
      )}
    </div>
    </>
  );
}
