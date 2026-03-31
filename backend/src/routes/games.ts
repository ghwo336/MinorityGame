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

  // POST /api/games/:id/commit  - 투표 데이터 저장 (choice + salt)
  router.post("/:id/commit", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        res.status(400).json({ error: "Invalid game ID" });
        return;
      }

      const { player, choice, salt, signature } = req.body;

      if (!player || !choice || !salt || !signature) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      if (choice !== 1 && choice !== 2) {
        res.status(400).json({ error: "Invalid choice" });
        return;
      }

      const result = await queries.storeVoteData({
        gameId,
        player: player.toLowerCase(),
        choice,
        salt,
        signature,
      });

      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ ok: true });
    } catch (err) {
      console.error(`POST /api/games/${req.params.id}/commit error:`, err);
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
