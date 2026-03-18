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

  const create = (question: string, optionA: string, optionB: string) => {
    writeContract({
      address: MINORITY_GAME_ADDRESS,
      abi: MINORITY_GAME_ABI,
      functionName: "createGame",
      args: [question, optionA, optionB],
      value: parseEther("0.005"),
    });
  };

  return { create, isPending, isConfirming, isSuccess, hash, error };
}

export function useJoinGame() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const join = (gameId: number, choice: 1 | 2) => {
    writeContract({
      address: MINORITY_GAME_ADDRESS,
      abi: MINORITY_GAME_ABI,
      functionName: "joinGame",
      args: [BigInt(gameId), choice],
      value: parseEther("0.001"),
    });
  };

  return { join, isPending, isConfirming, isSuccess, hash, error };
}

export function useResolveGame() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const resolve = (gameId: number) => {
    writeContract({
      address: MINORITY_GAME_ADDRESS,
      abi: MINORITY_GAME_ABI,
      functionName: "resolveGame",
      args: [BigInt(gameId)],
    });
  };

  return { resolve, isPending, isConfirming, isSuccess, hash, error };
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
