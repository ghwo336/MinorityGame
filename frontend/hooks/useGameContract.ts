"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { MINORITY_GAME_ABI, MINORITY_GAME_ADDRESS } from "@/config/contracts";
import { parseEther } from "viem";

// ─── Read Hooks ──────────────────────────────────────────

export function useGameCount() {
  return useReadContract({
    address: MINORITY_GAME_ADDRESS,
    abi: MINORITY_GAME_ABI,
    functionName: "gameCount",
  });
}

export function useGameData(gameId: number) {
  return useReadContract({
    address: MINORITY_GAME_ADDRESS,
    abi: MINORITY_GAME_ABI,
    functionName: "getGame",
    args: [BigInt(gameId)],
  });
}

export function usePlayerChoice(
  gameId: number,
  address?: `0x${string}`
) {
  return useReadContract({
    address: MINORITY_GAME_ADDRESS,
    abi: MINORITY_GAME_ABI,
    functionName: "getPlayerChoice",
    args: address ? [BigInt(gameId), address] : undefined,
    query: { enabled: !!address },
  });
}

export function useClaimable(
  gameId: number,
  address?: `0x${string}`
) {
  return useReadContract({
    address: MINORITY_GAME_ADDRESS,
    abi: MINORITY_GAME_ABI,
    functionName: "getClaimable",
    args: address ? [BigInt(gameId), address] : undefined,
    query: { enabled: !!address },
  });
}

export function usePendingWithdrawals(address?: `0x${string}`) {
  return useReadContract({
    address: MINORITY_GAME_ADDRESS,
    abi: MINORITY_GAME_ABI,
    functionName: "pendingWithdrawals",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

// ─── Write Hooks ─────────────────────────────────────────

export function useCreateGame() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const create = (question: string, optionA: string, optionB: string, durationSeconds: number) => {
    writeContract({
      address: MINORITY_GAME_ADDRESS,
      abi: MINORITY_GAME_ABI,
      functionName: "createGame",
      args: [question, optionA, optionB, BigInt(durationSeconds)],
      value: parseEther("0.003"),
      gas: 400000n,
    });
  };

  return { create, isPending, isConfirming, isSuccess, hash, error };
}

export function useCommitVote() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const commit = (gameId: number, commitment: `0x${string}`) => {
    writeContract({
      address: MINORITY_GAME_ADDRESS,
      abi: MINORITY_GAME_ABI,
      functionName: "commitVote",
      args: [BigInt(gameId), commitment],
      value: parseEther("0.001"),
    });
  };

  return { commit, isPending, isConfirming, isSuccess, hash, error };
}


export function useClaimReward() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const claim = (gameId: number) => {
    writeContract({
      address: MINORITY_GAME_ADDRESS,
      abi: MINORITY_GAME_ABI,
      functionName: "claimReward",
      args: [BigInt(gameId)],
    });
  };

  return { claim, isPending, isConfirming, isSuccess, hash, error };
}

export function useWithdrawPendingFees() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const withdraw = () => {
    writeContract({
      address: MINORITY_GAME_ADDRESS,
      abi: MINORITY_GAME_ABI,
      functionName: "withdrawPendingFees",
    });
  };

  return { withdraw, isPending, isConfirming, isSuccess, hash, error };
}

export function useEmergencyRefund() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const emergencyRefund = (gameId: number) => {
    writeContract({
      address: MINORITY_GAME_ADDRESS,
      abi: MINORITY_GAME_ABI,
      functionName: "emergencyRefund",
      args: [BigInt(gameId)],
    });
  };

  return { emergencyRefund, isPending, isConfirming, isSuccess, error };
}
