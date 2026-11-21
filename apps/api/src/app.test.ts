import { once } from "node:events";
import { expect, test } from "bun:test";
import { Router } from "express";
import { createApp } from "./app";

test("health reports database outages and recovers without exposing connection details", async () => {
  let databaseAvailable = true;
  const app = createApp(async () => {
    if (!databaseAvailable)
      throw new Error("internal database connection error");
  }, Router());
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Expected a TCP address");

    const getHealth = () =>
      fetch(`http://127.0.0.1:${address.port}/api/health`);

    const healthy = await getHealth();
    expect(healthy.status).toBe(200);
    expect(await healthy.json()).toEqual({ status: "ok" });

    databaseAvailable = false;
    const unavailable = await getHealth();
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ status: "unavailable" });

    databaseAvailable = true;
    const recovered = await getHealth();
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toEqual({ status: "ok" });
  } finally {
    server.close();
  }
});
