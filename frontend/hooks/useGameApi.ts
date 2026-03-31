"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import * as api from "@/lib/api";
import { toGameData } from "@/lib/api";

// ─── Read Hooks (API-backed) ────────────────────────────

export function useGamesListApi(opts?: { status?: number }) {
  return useQuery({
    queryKey: ["games", opts?.status],
    queryFn: () => api.getGames({ status: opts?.status, limit: 100 }),
    select: (data) => ({
      games: data.games.map(toGameData),
      total: data.total,
    }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useGameCountApi() {
  return useQuery({
    queryKey: ["gameCount"],
    queryFn: () => api.getGameCount(),
    select: (data) => data.count,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useGameDataApi(gameId: number) {
  return useQuery({
    queryKey: ["game", gameId],
    queryFn: () => api.getGame(gameId),
    select: toGameData,
    staleTime: 5_000,
    refetchInterval: 12_000,
  });
}

export function usePlayerStatusApi(gameId: number, address?: string) {
  return useQuery({
    queryKey: ["playerStatus", gameId, address],
    queryFn: () => api.getPlayerStatus(gameId, address!),
    enabled: !!address,
    staleTime: 5_000,
    refetchInterval: 12_000,
  });
}

export function usePlayerGamesApi(address?: string) {
  return useQuery({
    queryKey: ["playerGames", address],
    queryFn: () => api.getPlayerGames(address!),
    enabled: !!address,
    select: (data) => ({
      positions: data.positions.map((p) => ({
        ...p,
        game: toGameData(p.game),
      })),
      total: data.total,
    }),
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 15_000,
  });
}

// ─── Invalidation after write tx ────────────────────────

export function useRefetchAfterTx(isSuccess?: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSuccess) return;
    queryClient.invalidateQueries({ queryKey: ["games"] });
    queryClient.invalidateQueries({ queryKey: ["game"] });
    queryClient.invalidateQueries({ queryKey: ["gameCount"] });
    queryClient.invalidateQueries({ queryKey: ["playerStatus"] });
    queryClient.invalidateQueries({ queryKey: ["playerGames"] });
  }, [isSuccess, queryClient]);
}
