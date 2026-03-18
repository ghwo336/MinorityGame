import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { prisma } from "./db/client.js";
import { startIndexer } from "./indexer/indexer.js";
import { gamesRouter } from "./routes/games.js";
import { playersRouter } from "./routes/players.js";
import { healthRouter } from "./routes/health.js";

async function main() {
  await prisma.$connect();
  console.log("Database connected");

  startIndexer(config);

  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.use("/api/games", gamesRouter());
  app.use("/api/players", playersRouter());
  app.use("/api/health", healthRouter());

  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
