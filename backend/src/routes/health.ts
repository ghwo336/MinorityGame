import { Router } from "express";
import * as queries from "../db/queries.js";

export function healthRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const lastBlock = await queries.getLastBlock();
      res.json({
        status: "ok",
        lastBlock: lastBlock.toString(),
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Database unavailable" });
    }
  });

  return router;
}
