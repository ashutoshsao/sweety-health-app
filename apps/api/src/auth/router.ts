import express from "express";
import jwt from "jsonwebtoken";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { noStore, parseJson } from "../http";
import { authenticationRequired, requireAuth } from "./require-auth";

const publicUser = {
  id: true,
  name: true,
  email: true,
  timeZone: true,
} as const;
const invalidCredentials = { error: "Email or password is incorrect." };
const emailLocalPart =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const emailDomain =
  /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+$/;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEmail(value: string) {
  const [local, domain, extra] = value.split("@");
  return (
    value.length <= 254 &&
    local.length <= 64 &&
    domain !== undefined &&
    extra === undefined &&
    emailLocalPart.test(local) &&
    emailDomain.test(domain)
  );
}

function isPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") <= 72 &&
    [...value].length >= 8
  );
}

export function createAuthRouter(
  prisma: PrismaClient,
  secret: string,
  reportingTimeZone = "UTC",
) {
  const router = express.Router();
  router.use(noStore);

  router.post("/signup", parseJson, async (request, response) => {
    const { name, email, password } = request.body ?? {};
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = normalizeEmail(email);

    if (
      !trimmedName ||
      trimmedName.includes("\0") ||
      [...trimmedName].length > 100
    ) {
      response
        .status(400)
        .json({ error: "Enter a name between 1 and 100 characters." });
      return;
    }
    if (!isEmail(normalizedEmail)) {
      response.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    if (!isPassword(password)) {
      response.status(400).json({
        error:
          "Enter a password of at least 8 characters and at most 72 UTF-8 bytes.",
      });
      return;
    }
    const passwordHash = await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 10,
    });
    try {
      const user = await prisma.user.create({
        data: {
          name: trimmedName,
          email: normalizedEmail,
          passwordHash,
          timeZone: reportingTimeZone,
        },
        select: publicUser,
      });
      response.status(201).json({ user });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        response
          .status(409)
          .json({ error: "An account already uses this email address." });
        return;
      }
      throw error;
    }
  });

  router.post("/login", parseJson, async (request, response) => {
    const { email, password } = request.body ?? {};
    const normalizedEmail = normalizeEmail(email);
    if (!isEmail(normalizedEmail) || !isPassword(password)) {
      response
        .status(400)
        .json({ error: "Enter a valid email address and password." });
      return;
    }

    const account = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { ...publicUser, passwordHash: true },
    });
    if (
      !account ||
      !(await Bun.password.verify(password, account.passwordHash, "bcrypt"))
    ) {
      response.status(401).json(invalidCredentials);
      return;
    }

    const { passwordHash: _passwordHash, ...user } = account;
    const token = jwt.sign({}, secret, {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: "1h",
    });
    response.json({ token, user });
  });

  router.get("/me", requireAuth(secret), async (request, response) => {
    const user = request.userId
      ? await prisma.user.findUnique({
          where: { id: request.userId },
          select: publicUser,
        })
      : null;
    if (!user) {
      response.status(401).json(authenticationRequired);
      return;
    }
    response.json({ user });
  });

  return router;
}
