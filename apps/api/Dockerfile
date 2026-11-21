FROM oven/bun:1.4.4
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

COPY apps/api apps/api
WORKDIR /app/apps/api
RUN bun run prisma:generate

EXPOSE 3001
CMD ["sh", "-c", "bun run prisma:deploy && exec bun run start"]
