import express from "express";
import type { ErrorRequestHandler, RequestHandler } from "express";

export const parseJson = express.json({ limit: "8kb" });

export const noStore: RequestHandler = (_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
};

export class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const handleRequestError: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof RequestError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error?.type === "entity.too.large") {
    response.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    response.status(400).json({ error: "Please send valid JSON." });
    return;
  }
  response
    .status(500)
    .json({ error: "Something went wrong. Please try again." });
};

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  );
}
