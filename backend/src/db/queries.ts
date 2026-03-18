import { prisma } from "./client.js";
import { Prisma } from "../generated/prisma/client.js";

// ─── Sync State ─────────────────────────────────────────

export async function getLastBlock(): Promise<bigint> {
  const state = await prisma.syncState.findUnique({
    where: { id: 1 },
    select: { lastBlock: true },
  });
  return state?.lastBlock ?? 0n;
}

export async function updateLastBlock(block: number): Promise<void> {
  await prisma.syncState.upsert({
    where: { id: 1 },
    update: { lastBlock: BigInt(block) },
    create: { id: 1, lastBlock: BigInt(block) },
  });
}

// ─── Games ──────────────────────────────────────────────

export async function insertGame(data: {
  gameId: number;
  creator: string;
  startTime: string;
  question: string;
  optionA: string;
  optionB: string;
  blockNumber: number;
}): Promise<void> {
  await prisma.game.upsert({
    where: { gameId: data.gameId },
    update: {},
    create: {
      gameId: data.gameId,
      creator: data.creator,
      startTime: BigInt(data.startTime),
      question: data.question,
      optionA: data.optionA,
      optionB: data.optionB,
      blockNumber: BigInt(data.blockNumber),
    },
  });
}

export async function incrementGameVote(data: {
  gameId: number;
  choice: number;
  betAmount: string;
}): Promise<void> {
  const col = data.choice === 1 ? "count_a" : "count_b";
  await prisma.$executeRawUnsafe(
    `UPDATE games
     SET ${col} = ${col} + 1,
         total_pool = (CAST(total_pool AS NUMERIC) + $1)::TEXT
     WHERE game_id = $2`,
    data.betAmount,
    data.gameId
  );
}

export async function updateGameResolved(data: {
  gameId: number;
  winningChoice: number;
  isTie: boolean;
}): Promise<void> {
  await prisma.game.update({
    where: { gameId: data.gameId },
    data: {
      status: 1,
      winningChoice: data.winningChoice,
      isTie: data.isTie,
    },
  });
}

export async function updateGameFull(data: {
  gameId: number;
  totalPool: string;
  countA: number;
  countB: number;
  payoutPerPlayer: string;
  status: number;
  winningChoice: number;
  isTie: boolean;
}): Promise<void> {
  await prisma.game.update({
    where: { gameId: data.gameId },
    data: {
      totalPool: data.totalPool,
      countA: data.countA,
      countB: data.countB,
      payoutPerPlayer: data.payoutPerPlayer,
      status: data.status,
      winningChoice: data.winningChoice,
      isTie: data.isTie,
    },
  });
}

// ─── Player Choices ─────────────────────────────────────

export async function insertPlayerChoice(data: {
  gameId: number;
  player: string;
  choice: number;
  blockNumber: number;
}): Promise<void> {
  await prisma.playerChoice.upsert({
    where: {
      gameId_player: {
        gameId: data.gameId,
        player: data.player,
      },
    },
    update: {},
    create: {
      gameId: data.gameId,
      player: data.player,
      choice: data.choice,
      blockNumber: BigInt(data.blockNumber),
    },
  });
}

// ─── Claims ─────────────────────────────────────────────

export async function insertClaim(data: {
  gameId: number;
  player: string;
  amount: string;
  blockNumber: number;
}): Promise<void> {
  await prisma.claim.upsert({
    where: {
      gameId_player: {
        gameId: data.gameId,
        player: data.player,
      },
    },
    update: {},
    create: {
      gameId: data.gameId,
      player: data.player,
      amount: data.amount,
      blockNumber: BigInt(data.blockNumber),
    },
  });
}

// ─── Auto-resolve ───────────────────────────────────────

export async function getExpiredActiveGames(): Promise<number[]> {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const cutoff = nowSec - 86400n; // 24 hours ago
  const games = await prisma.game.findMany({
    where: {
      status: 0,
      startTime: { lte: cutoff },
    },
    select: { gameId: true },
  });
  return games.map((g) => g.gameId);
}

// ─── API Reads ──────────────────────────────────────────

export async function getGameCount(): Promise<number> {
  return await prisma.game.count();
}

export async function getGames(opts: {
  status?: number;
  limit: number;
  offset: number;
}): Promise<{ games: ReturnType<typeof mapGameRow>[]; total: number }> {
  const where: Prisma.GameWhereInput =
    opts.status !== undefined ? { status: opts.status } : {};

  const [total, games] = await prisma.$transaction([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      orderBy: { gameId: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
  ]);

  return {
    games: games.map(mapGameRow),
    total,
  };
}

export async function getGame(gameId: number) {
  const game = await prisma.game.findUnique({
    where: { gameId },
  });
  if (!game) return null;
  return mapGameRow(game);
}

export async function getPlayerGameStatus(gameId: number, address: string) {
  const [playerChoice, claim] = await prisma.$transaction([
    prisma.playerChoice.findUnique({
      where: { gameId_player: { gameId, player: address } },
      select: { choice: true },
    }),
    prisma.claim.findUnique({
      where: { gameId_player: { gameId, player: address } },
      select: { player: true },
    }),
  ]);

  const choice = playerChoice?.choice ?? 0;
  const hasClaimed = claim !== null;

  let claimableAmount = "0";
  if (choice !== 0 && !hasClaimed) {
    const game = await getGame(gameId);
    if (game && game.status === 1) {
      if (game.isTie || choice === game.winningChoice) {
        claimableAmount = game.payoutPerPlayer;
      }
    }
  }

  return { choice, hasClaimed, claimableAmount };
}

export async function getPlayerGames(address: string, opts: {
  limit: number;
  offset: number;
}) {
  const [total, positions] = await prisma.$transaction([
    prisma.playerChoice.count({ where: { player: address } }),
    prisma.playerChoice.findMany({
      where: { player: address },
      include: { game: true },
      orderBy: { gameId: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
  ]);

  const gameIds = positions.map((p) => p.gameId);
  const claims = await prisma.claim.findMany({
    where: { gameId: { in: gameIds }, player: address },
    select: { gameId: true },
  });
  const claimSet = new Set(claims.map((c) => c.gameId));

  return {
    positions: positions.map((p) => ({
      gameId: p.gameId,
      choice: p.choice,
      hasClaimed: claimSet.has(p.gameId),
      game: mapGameRow(p.game),
    })),
    total,
  };
}

function mapGameRow(game: {
  gameId: number;
  creator: string;
  startTime: bigint;
  question: string;
  optionA: string;
  optionB: string;
  totalPool: string;
  countA: number;
  countB: number;
  status: number;
  winningChoice: number;
  payoutPerPlayer: string;
  isTie: boolean;
}) {
  return {
    gameId: game.gameId,
    creator: game.creator,
    startTime: game.startTime.toString(),
    question: game.question,
    optionA: game.optionA,
    optionB: game.optionB,
    totalPool: game.totalPool,
    countA: game.countA,
    countB: game.countB,
    status: game.status,
    winningChoice: game.winningChoice,
    payoutPerPlayer: game.payoutPerPlayer,
    isTie: game.isTie,
  };
}
