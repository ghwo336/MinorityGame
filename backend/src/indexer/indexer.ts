import { createPublicClient, createWalletClient, http, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { MINORITY_GAME_ABI } from "./abi.js";
import type { Config } from "../config.js";
import * as queries from "../db/queries.js";

export function startIndexer(cfg: Config) {
  const transport = http(cfg.rpcUrl);

  const client = createPublicClient({
    chain: sepolia,
    transport,
  });

  const walletClient = cfg.resolverPrivateKey
    ? createWalletClient({
        chain: sepolia,
        transport,
        account: privateKeyToAccount(cfg.resolverPrivateKey),
      })
    : null;

  let isPolling = false;

  async function autoRevealExpired() {
    if (!walletClient) return;

    const expiredIds = await queries.getExpiredActiveGames();
    if (expiredIds.length === 0) return;

    for (const gameId of expiredIds) {
      try {
        const game = await queries.getGame(gameId);
        if (!game) continue;

        // 참여자 없는 만료 게임 → 온체인 종료
        if (game.commitCount === 0) {
          const hash = await walletClient.writeContract({
            address: cfg.contractAddress,
            abi: MINORITY_GAME_ABI,
            functionName: "endEmptyGame",
            args: [BigInt(gameId)],
          });
          console.log(`Ended empty game ${gameId} (tx: ${hash})`);
          continue;
        }

        const commits = await queries.getVoteCommitsForReveal(gameId);

        // 백엔드에 데이터가 없는 커밋이 있으면 아직 reveal 불가
        if (commits.length < game.commitCount) {
          console.log(
            `Game ${gameId}: ${game.commitCount - commits.length} commits missing vote data, skipping reveal`
          );
          continue;
        }

        const players = commits.map((c) => c.player as `0x${string}`);
        const choices = commits.map((c) => c.choice as 1 | 2);
        const salts = commits.map((c) => c.salt as `0x${string}`);

        const hash = await walletClient.writeContract({
          address: cfg.contractAddress,
          abi: MINORITY_GAME_ABI,
          functionName: "revealVotes",
          args: [BigInt(gameId), players, choices, salts],
        });

        console.log(`Auto-revealed game ${gameId} (${commits.length} votes, tx: ${hash})`);
        await queries.markCommitsRevealed(gameId);
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("not active") || msg.includes("not expired")) {
          // skip silently
        } else {
          console.error(`Failed to auto-reveal game ${gameId}:`, msg.slice(0, 120));
        }
      }
    }
  }

  async function pollCycle() {
    if (isPolling) return;
    isPolling = true;

    try {
      const lastBlock = await queries.getLastBlock();
      const currentBlock = await client.getBlockNumber();

      const deployBlockN = BigInt(cfg.deployBlock);
      const fromBlock = lastBlock >= deployBlockN ? lastBlock + 1n : deployBlockN;
      if (fromBlock > currentBlock) {
        isPolling = false;
        return;
      }

      const toBlock = currentBlock - fromBlock > 2000n
        ? fromBlock + 2000n
        : currentBlock;

      const logs = await client.getLogs({
        address: cfg.contractAddress,
        fromBlock,
        toBlock,
      });

      console.log(`Polling blocks ${fromBlock}..${toBlock}`);

      if (logs.length > 0) {
        const events = parseEventLogs({ abi: MINORITY_GAME_ABI, logs });

        for (const event of events) {
          const blockNumber = Number(event.blockNumber);

          switch (event.eventName) {
            case "GameCreated": {
              const args = event.args;
              const gameData = await client.readContract({
                address: cfg.contractAddress,
                abi: MINORITY_GAME_ABI,
                functionName: "getGame",
                args: [args.gameId],
              });
              await queries.insertGame({
                gameId: Number(args.gameId),
                creator: args.creator.toLowerCase(),
                startTime: args.startTime.toString(),
                duration: (gameData as any).duration.toString(),
                question: args.question,
                optionA: args.optionA,
                optionB: args.optionB,
                blockNumber,
              });
              break;
            }

            case "VoteCommitted": {
              const args = event.args;
              await queries.insertVoteCommit({
                gameId: Number(args.gameId),
                player: args.player.toLowerCase(),
                commitmentHash: args.commitment,
              });
              await queries.updateGameTotalPool({
                gameId: Number(args.gameId),
                betAmount: "1000000000000000", // 0.001 ETH
              });
              break;
            }

            case "Joined": {
              // reveal 후 emitted - playerChoices 업데이트
              const args = event.args;
              await queries.insertPlayerChoice({
                gameId: Number(args.gameId),
                player: args.player.toLowerCase(),
                choice: Number(args.choice),
                blockNumber,
              });
              break;
            }

            case "Resolved": {
              const args = event.args;
              const gameId = Number(args.gameId);
              await queries.updateGameResolved({
                gameId,
                winningChoice: Number(args.winningChoice),
                isTie: args.isTie,
              });
              try {
                const game = await client.readContract({
                  address: cfg.contractAddress,
                  abi: MINORITY_GAME_ABI,
                  functionName: "getGame",
                  args: [BigInt(gameId)],
                }) as any;
                await queries.updateGameFull({
                  gameId,
                  totalPool: game.totalPool.toString(),
                  countA: Number(game.countA),
                  countB: Number(game.countB),
                  payoutPerPlayer: game.payoutPerPlayer.toString(),
                  status: Number(game.status),
                  winningChoice: Number(game.winningChoice),
                  isTie: game.isTie,
                });
              } catch (err) {
                console.error(`Failed to backfill game ${gameId}:`, err);
              }
              break;
            }

            case "Claimed": {
              const args = event.args;
              await queries.insertClaim({
                gameId: Number(args.gameId),
                player: args.player.toLowerCase(),
                amount: args.amount.toString(),
                blockNumber,
              });
              break;
            }
          }
        }

        console.log(`Indexed blocks ${fromBlock}..${toBlock} (${events.length} events)`);
      }

      await queries.updateLastBlock(Number(toBlock));

      if (toBlock >= currentBlock) {
        await autoRevealExpired();
      }
    } catch (err) {
      console.error("Indexer poll error:", err);
    } finally {
      isPolling = false;
    }
  }

  pollCycle();
  setInterval(pollCycle, cfg.pollIntervalMs);
  console.log(`Indexer started (polling every ${cfg.pollIntervalMs}ms)`);
  if (walletClient) {
    console.log(`Auto-resolver enabled (${walletClient.account.address})`);
  }
}
