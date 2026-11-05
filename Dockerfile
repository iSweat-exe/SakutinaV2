FROM oven/bun:1-slim AS base

WORKDIR /app

# Addon Rust : compilé pour Linux glibc, au même niveau de distribution (Debian bookworm) que l'image Bun.
FROM rust:1-slim-bookworm AS native
WORKDIR /native
COPY packages/native/Cargo.toml packages/native/Cargo.lock packages/native/build.rs ./
COPY packages/native/src ./src
COPY packages/native/assets ./assets
RUN cargo build --release --locked

FROM base AS installer
COPY package.json bun.lock ./
COPY apps/bot/package.json ./apps/bot/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/native/package.json ./packages/native/package.json
RUN bun install --frozen-lockfile --production

FROM base AS runner
WORKDIR /app

COPY --from=installer /app/node_modules ./node_modules
COPY package.json index.ts ./
COPY apps/bot ./apps/bot
COPY packages/config ./packages/config
COPY packages/native/package.json packages/native/index.ts ./packages/native/
COPY --from=native /native/target/release/libsakutina_native.so ./packages/native/dist/sakutina_native.node

EXPOSE 3000

CMD ["bun", "run", "start"]
