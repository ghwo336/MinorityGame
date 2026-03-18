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

  // Auto-resolver wallet (optional)
  const walletClient = cfg.resolverPrivateKey
    ? createWalletClient({
        chain: sepolia,
        transport,
        account: privateKeyToAccount(cfg.resolverPrivateKey),
      })
    : null;

  let isPolling = false;

  async function autoResolveExpired() {
    if (!walletClient) return;

    const expiredIds = await queries.getExpiredActiveGames();
    if (expiredIds.length === 0) return;

    for (const gameId of expiredIds) {
      try {
        const hash = await walletClient.writeContract({
          address: cfg.contractAddress,
          abi: MINORITY_GAME_ABI,
          functionName: "resolveGame",
          args: [BigInt(gameId)],
        });
        console.log(`Auto-resolved game ${gameId} (tx: ${hash})`);
      } catch (err: any) {
        // Skip games with no participants or already resolved
        const msg = err?.message || "";
        if (msg.includes("No participants") || msg.includes("not active")) {
          console.log(`Skip auto-resolve game ${gameId}: ${msg.slice(0, 80)}`);
        } else {
          console.error(`Failed to auto-resolve game ${gameId}:`, msg.slice(0, 120));
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
        const events = parseEventLogs({
          abi: MINORITY_GAME_ABI,
          logs,
        });

        for (const event of events) {
          const blockNumber = Number(event.blockNumber);

          switch (event.eventName) {
            case "GameCreated": {
              const args = event.args;
              await queries.insertGame({
                gameId: Number(args.gameId),
                creator: args.creator.toLowerCase(),
                startTime: args.startTime.toString(),
                question: args.question,
                optionA: args.optionA,
                optionB: args.optionB,
                blockNumber,
              });
              break;
            }
            case "Joined": {
              const args = event.args;
              await queries.insertPlayerChoice({
                gameId: Number(args.gameId),
                player: args.player.toLowerCase(),
                choice: Number(args.choice),
                blockNumber,
              });
              await queries.incrementGameVote({
                gameId: Number(args.gameId),
                choice: Number(args.choice),
                betAmount: "1000000000000000", // 0.001 ETH
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
                });
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

      // Auto-resolve expired games (only when caught up)
      if (toBlock >= currentBlock) {
        await autoResolveExpired();
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
