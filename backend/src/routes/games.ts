import { Router } from "express";
import * as queries from "../db/queries.js";

export function gamesRouter(): Router {
  const router = Router();

  // GET /api/games/count
  router.get("/count", async (_req, res) => {
    try {
      const count = await queries.getGameCount();
      res.json({ count });
    } catch (err) {
      console.error("GET /api/games/count error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/games/:id
  router.get("/:id", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        res.status(400).json({ error: "Invalid game ID" });
        return;
      }
      const game = await queries.getGame(gameId);
      if (!game) {
        res.status(404).json({ error: "Game not found" });
        return;
      }
      res.json(game);
    } catch (err) {
      console.error(`GET /api/games/${req.params.id} error:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/games/:id/players/:address
  router.get("/:id/players/:address", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        res.status(400).json({ error: "Invalid game ID" });
        return;
      }
      const address = req.params.address.toLowerCase();
      const status = await queries.getPlayerGameStatus(gameId, address);
      res.json(status);
    } catch (err) {
      console.error(`GET /api/games/${req.params.id}/players error:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/games  (?status=0|1, ?limit, ?offset)
  router.get("/", async (req, res) => {
    try {
      const status = req.query.status !== undefined ? parseInt(req.query.status as string) : undefined;
      const limit = Math.min(parseInt((req.query.limit as string) || "50"), 100);
      const offset = parseInt((req.query.offset as string) || "0");

      const result = await queries.getGames({ status, limit, offset });
      res.json(result);
    } catch (err) {
      console.error("GET /api/games error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
