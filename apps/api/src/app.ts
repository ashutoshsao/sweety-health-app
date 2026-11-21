import express from "express";

export function createApp(checkDatabase: () => Promise<unknown>) {
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

  return app;
}
