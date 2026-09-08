import { Router, type IRouter } from "express";
import {
  answerFromNorthCreekIndex,
  getNorthCreekIndexStatus,
  getNorthCreekIndexSummary,
  refreshNorthCreekIndex,
} from "../lib/northCreekIndex";

const router: IRouter = Router();

router.get("/north-creek/index/status", async (_req, res): Promise<void> => {
  res.json(await getNorthCreekIndexSummary());
});

router.post("/north-creek/index/refresh", async (req, res): Promise<void> => {
  const rawMaxPages = req.body?.maxPages;
  const maxPages = typeof rawMaxPages === "number" && Number.isFinite(rawMaxPages)
    ? Math.max(1, Math.min(Math.floor(rawMaxPages), 500))
    : undefined;
  res.json(await refreshNorthCreekIndex({ maxPages }));
});

router.post("/north-creek/chat", async (req, res): Promise<void> => {
  const question = req.body?.question;
  if (typeof question !== "string" || !question.trim()) {
    res.status(400).json({ error: "A question is required." });
    return;
  }
  res.json(await answerFromNorthCreekIndex(question.trim()));
});

router.get("/north-creek/index/health", async (_req, res): Promise<void> => {
  const status = await getNorthCreekIndexStatus();
  res.json({
    ready: status.state === "ready" && status.page_count > 0,
    page_count: status.page_count,
    event_count: status.event_count,
    last_completed_at: status.last_completed_at,
    feed_url: status.feed_url,
    feed_confirmed: status.feed_confirmed,
  });
});

export default router;