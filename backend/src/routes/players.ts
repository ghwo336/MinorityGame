import { Router } from "express";
import * as queries from "../db/queries.js";

export function playersRouter(): Router {
  const router = Router();

  // GET /api/players/:address/games
  router.get("/:address/games", async (req, res) => {
    try {
      const address = req.params.address.toLowerCase();
      const limit = Math.min(parseInt((req.query.limit as string) || "50"), 100);
      const offset = parseInt((req.query.offset as string) || "0");

      const result = await queries.getPlayerGames(address, { limit, offset });
      res.json(result);
    } catch (err) {
      console.error(`GET /api/players/${req.params.address}/games error:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
