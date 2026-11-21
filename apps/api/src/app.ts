import express from "express";
import type { Router } from "express";
import { handleRequestError } from "./http";

export function createApp(
  checkDatabase: () => Promise<unknown>,
  auth: Router,
  readings?: Router,
  reports?: Router,
) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/health", async (_request, response) => {
    try {
      await checkDatabase();
      response.json({ status: "ok" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/api/auth", auth);
  if (readings) app.use("/api/readings", readings);
  if (reports) app.use("/api/reports", reports);
  app.use(handleRequestError);

  return app;
}
