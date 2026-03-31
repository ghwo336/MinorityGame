import { keccak256, encodePacked, verifyMessage } from "viem";
import { prisma } from "./client.js";

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
  duration: string;
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
      duration: BigInt(data.duration),
      question: data.question,
      optionA: data.optionA,
      optionB: data.optionB,
      blockNumber: BigInt(data.blockNumber),
    },
  });
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

// ─── Vote Commits ────────────────────────────────────────

export async function insertVoteCommit(data: {
  gameId: number;
  player: string;
  commitmentHash: string;
}): Promise<void> {
  // Idempotent: only increment commitCount if this is a NEW commit (prevents double-counting on re-index)
  const existing = await prisma.voteCommit.findUnique({
    where: { gameId_player: { gameId: data.gameId, player: data.player } },
    select: { player: true },
  });
  if (existing) return;

  await prisma.$transaction([
    prisma.voteCommit.create({
      data: {
        gameId: data.gameId,
        player: data.player,
        commitmentHash: data.commitmentHash,
      },
    }),
    prisma.game.update({
      where: { gameId: data.gameId },
      data: { commitCount: { increment: 1 } },
    }),
  ]);
}

export async function updateGameTotalPool(data: {
  gameId: number;
  betAmount: string;
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE games SET total_pool = (CAST(total_pool AS NUMERIC) + $1)::TEXT WHERE game_id = $2`,
    data.betAmount,
    data.gameId
  );
}

export async function storeVoteData(data: {
  gameId: number;
  player: string;
  choice: number;
  salt: string;
  signature: string;
}): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.voteCommit.findUnique({
    where: { gameId_player: { gameId: data.gameId, player: data.player } },
  });

  if (!existing) {
    return { ok: false, error: "No commitment found for this player" };
  }
  if (existing.choice !== null) {
    return { ok: true }; // 이미 저장됨
  }

  // choice+salt가 on-chain commitment과 일치하는지 직접 검증 (입력값 신뢰 안 함)
  const computed = keccak256(
    encodePacked(
      ["uint256", "uint8", "bytes32", "address"],
      [
        BigInt(data.gameId),
        data.choice as 1 | 2,
        data.salt as `0x${string}`,
        data.player as `0x${string}`,
      ]
    )
  );
  if (computed !== existing.commitmentHash) {
    return { ok: false, error: "Vote data does not match commitment" };
  }

  // EIP-191 서명으로 실제 지갑 소유 증명
  let isValid = false;
  try {
    isValid = await verifyMessage({
      address: data.player as `0x${string}`,
      message: `minority-commit:${data.gameId}:${computed}`,
      signature: data.signature as `0x${string}`,
    });
  } catch {
    return { ok: false, error: "Signature verification failed" };
  }
  if (!isValid) {
    return { ok: false, error: "Invalid signature" };
  }

  await prisma.voteCommit.update({
    where: { gameId_player: { gameId: data.gameId, player: data.player } },
    data: { choice: data.choice, salt: data.salt },
  });

  return { ok: true };
}

export async function getVoteCommitsForReveal(gameId: number): Promise<{
  player: string;
  choice: number;
  salt: string;
}[]> {
  const commits = await prisma.voteCommit.findMany({
    where: { gameId, revealed: false },
  });

  // choice/salt가 없는 커밋은 reveal 불가 (유저가 백엔드에 데이터 미전송)
  return commits
    .filter((c) => c.choice !== null && c.salt !== null)
    .map((c) => ({ player: c.player, choice: c.choice!, salt: c.salt! }));
}

export async function markCommitsRevealed(gameId: number): Promise<void> {
  await prisma.voteCommit.updateMany({
    where: { gameId },
    data: { revealed: true },
  });
}

export async function getVoteCommit(gameId: number, player: string) {
  return prisma.voteCommit.findUnique({
    where: { gameId_player: { gameId, player } },
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
    where: { gameId_player: { gameId: data.gameId, player: data.player } },
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
    where: { gameId_player: { gameId: data.gameId, player: data.player } },
    update: {},
    create: {
      gameId: data.gameId,
      player: data.player,
      amount: data.amount,
      blockNumber: BigInt(data.blockNumber),
    },
  });
}

// ─── Auto-reveal ─────────────────────────────────────────

export async function getExpiredActiveGames(): Promise<number[]> {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const games = await prisma.game.findMany({ where: { status: 0 } });
  return games
    .filter((g) => g.startTime + g.duration <= nowSec)
    .map((g) => g.gameId);
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
  const nowSec = BigInt(Math.floor(Date.now() / 1000));

  const isNoParticipantExpired = (g: {
    status: number; commitCount: number; startTime: bigint; duration: bigint;
  }) => g.status === 0 && g.commitCount === 0 && g.startTime + g.duration <= nowSec;

  if (opts.status === 0) {
    const all = await prisma.game.findMany({
      where: { status: 0 },
      orderBy: { gameId: "desc" },
    });
    const filtered = all.filter((g) => !isNoParticipantExpired(g));
    const paginated = filtered.slice(opts.offset, opts.offset + opts.limit);
    return { games: paginated.map(mapGameRow), total: filtered.length };
  }

  if (opts.status === 1) {
    const all = await prisma.game.findMany({
      where: { OR: [{ status: 1 }, { status: 0, commitCount: 0 }] },
      orderBy: { gameId: "desc" },
    });
    const filtered = all.filter((g) => g.status === 1 || isNoParticipantExpired(g));
    const paginated = filtered.slice(opts.offset, opts.offset + opts.limit);
    return { games: paginated.map(mapGameRow), total: filtered.length };
  }

  const [total, games] = await prisma.$transaction([
    prisma.game.count(),
    prisma.game.findMany({ orderBy: { gameId: "desc" }, take: opts.limit, skip: opts.offset }),
  ]);
  return { games: games.map(mapGameRow), total };
}

export async function getGame(gameId: number) {
  const game = await prisma.game.findUnique({ where: { gameId } });
  if (!game) return null;
  return mapGameRow(game);
}

export async function getPlayerGameStatus(gameId: number, address: string) {
  const [playerChoice, claim, voteCommit] = await prisma.$transaction([
    prisma.playerChoice.findUnique({
      where: { gameId_player: { gameId, player: address } },
      select: { choice: true },
    }),
    prisma.claim.findUnique({
      where: { gameId_player: { gameId, player: address } },
      select: { player: true },
    }),
    prisma.voteCommit.findUnique({
      where: { gameId_player: { gameId, player: address } },
      select: { choice: true },
    }),
  ]);

  const choice = playerChoice?.choice ?? 0;
  const hasCommitted = voteCommit !== null;
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

  return { choice, hasCommitted, hasClaimed, claimableAmount };
}

export async function getPlayerGames(address: string, opts: {
  limit: number;
  offset: number;
}) {
  // voteCommits 기준으로 조회 (active + resolved 게임 모두 포함)
  const total = await prisma.voteCommit.count({ where: { player: address } });
  const commits = await prisma.voteCommit.findMany({
    where: { player: address },
    include: { game: true },
    orderBy: { gameId: "desc" },
    take: opts.limit,
    skip: opts.offset,
  });

  const gameIds = commits.map((c) => c.gameId);

  // resolve 후 실제 choice (playerChoices) 와 claim 여부 병합
  const [revealedChoices, claims] = await prisma.$transaction([
    prisma.playerChoice.findMany({
      where: { gameId: { in: gameIds }, player: address },
      select: { gameId: true, choice: true },
    }),
    prisma.claim.findMany({
      where: { gameId: { in: gameIds }, player: address },
      select: { gameId: true },
    }),
  ]);

  const choiceMap = new Map(revealedChoices.map((p) => [p.gameId, p.choice]));
  const claimSet = new Set(claims.map((c) => c.gameId));

  return {
    positions: commits.map((c) => ({
      gameId: c.gameId,
      // reveal 됐으면 playerChoices 값, 아직이면 voteCommit에 저장된 값 (없으면 0 = 미공개)
      choice: choiceMap.get(c.gameId) ?? c.choice ?? 0,
      hasClaimed: claimSet.has(c.gameId),
      game: mapGameRow(c.game),
    })),
    total,
  };
}

function mapGameRow(game: {
  gameId: number;
  creator: string;
  startTime: bigint;
  duration: bigint;
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
}) {
  return {
    gameId: game.gameId,
    creator: game.creator,
    startTime: game.startTime.toString(),
    duration: game.duration.toString(),
    question: game.question,
    optionA: game.optionA,
    optionB: game.optionB,
    totalPool: game.totalPool,
    countA: game.countA,
    countB: game.countB,
    commitCount: game.commitCount,
    status: game.status,
    winningChoice: game.winningChoice,
    payoutPerPlayer: game.payoutPerPlayer,
    isTie: game.isTie,
  };
}
