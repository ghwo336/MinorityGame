import "dotenv/config";

export const config = {
  databaseUrl: process.env.DATABASE_URL || "postgres://localhost:5432/minority_game",
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  contractAddress: (process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  deployBlock: parseInt(process.env.DEPLOY_BLOCK || "0"),
  port: parseInt(process.env.PORT || "3001"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "12000"),
  resolverPrivateKey: (process.env.RESOLVER_PRIVATE_KEY || "") as `0x${string}`,
};

export type Config = typeof config;
