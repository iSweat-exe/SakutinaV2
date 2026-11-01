FROM oven/bun:1-slim AS base

WORKDIR /app

FROM base AS installer
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS runner
WORKDIR /app

COPY --from=installer /app/node_modules ./node_modules
COPY package.json tsconfig.json index.ts ./

EXPOSE 3000

CMD ["bun", "run", "index.ts"]