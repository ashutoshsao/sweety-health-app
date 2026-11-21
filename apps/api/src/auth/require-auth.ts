import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isUuid } from "../http";

export const authenticationRequired = { error: "Please sign in." };

export function requireAuth(secret: string): RequestHandler {
  return (request, response, next) => {
    const [, token] =
      /^Bearer (\S+)$/i.exec(request.get("authorization") ?? "") ?? [];
    if (!token) {
      response.status(401).json(authenticationRequired);
      return;
    }

    try {
      const claims = jwt.verify(token, secret, { algorithms: ["HS256"] });
      if (
        typeof claims === "string" ||
        typeof claims.exp !== "number" ||
        !isUuid(claims.sub)
      ) {
        response.status(401).json(authenticationRequired);
        return;
      }
      request.userId = claims.sub;
    } catch {
      response.status(401).json(authenticationRequired);
      return;
    }

    next();
  };
}
