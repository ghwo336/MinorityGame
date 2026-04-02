const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090/api";

// ─── API Response Types ─────────────────────────────────

export interface GameApiResponse {
  gameId: number;
  creator: string;
  startTime: string;
  duration: string;
  question: string;
  optionA: string;
  optionB: string;
  totalPool: string;
  countA: number;
  countB: number;
  commitCount: number;
  status: number;
  winningChoice: number;
  payoutPerPlayer: string;
  isTie: boolean;
}

export interface PlayerStatusResponse {
  choice: number;
  hasCommitted: boolean;
  hasClaimed: boolean;
  claimableAmount: string;
}

export interface PlayerGamePosition {
  gameId: number;
  choice: number;
  hasClaimed: boolean;
  game: GameApiResponse;
}

// ─── Converted Type (bigint-compatible with wagmi) ──────

export interface GameData {
  gameId: number;
  creator: string;
  startTime: bigint;
  duration: bigint;
  totalPool: bigint;
  countA: bigint;
  countB: bigint;
  commitCount: number;
  winningChoice: number;
  status: number;
  payoutPerPlayer: bigint;
  isTie: boolean;
  question: string;
  optionA: string;
  optionB: string;
}

export function toGameData(g: GameApiResponse): GameData {
  return {
    gameId: g.gameId,
    creator: g.creator,
    startTime: BigInt(g.startTime),
    duration: BigInt(g.duration ?? 86400),
    totalPool: BigInt(g.totalPool),
    countA: BigInt(g.countA),
    countB: BigInt(g.countB),
    commitCount: g.commitCount ?? 0,
    winningChoice: g.winningChoice,
    status: g.status,
    payoutPerPlayer: BigInt(g.payoutPerPlayer),
    isTie: g.isTie,
    question: g.question,
    optionA: g.optionA,
    optionB: g.optionB,
  };
}

// ─── Fetch Helpers ──────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ─── API Functions ──────────────────────────────────────

export async function getGames(opts?: { status?: number; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.status !== undefined) params.set("status", String(opts.status));
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return fetchJson<{ games: GameApiResponse[]; total: number }>(`/games${qs ? `?${qs}` : ""}`);
}

export async function getGameCount() {
  return fetchJson<{ count: number }>("/games/count");
}

export async function getGame(gameId: number) {
  return fetchJson<GameApiResponse>(`/games/${gameId}`);
}

export async function getPlayerStatus(gameId: number, address: string) {
  return fetchJson<PlayerStatusResponse>(`/games/${gameId}/players/${address}`);
}

export async function submitVoteData(
  gameId: number,
  player: string,
  choice: number,
  salt: string,
  signature: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/games/${gameId}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player, choice, salt, signature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
}

export async function resolveGame(gameId: number): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/games/${gameId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

export async function getPlayerGames(address: string, opts?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return fetchJson<{ positions: PlayerGamePosition[]; total: number }>(`/players/${address}/games${qs ? `?${qs}` : ""}`);
}
