# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY --link package.json package-lock.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    --mount=type=cache,target=/root/.npm \
    npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV DATABASE_URL=postgresql://cove:cove@127.0.0.1:5432/cove
COPY --link --from=deps /app/node_modules ./node_modules
COPY --link . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid appgroup --home-dir /app --shell /usr/sbin/nologin appuser
COPY --link --from=build --chown=appuser:appgroup /app/package.json /app/package-lock.json ./
COPY --link --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --link --from=build --chown=appuser:appgroup /app/.next ./.next
COPY --link --from=build --chown=appuser:appgroup /app/public ./public
COPY --link --from=build --chown=appuser:appgroup /app/prisma ./prisma
COPY --link --from=build --chown=appuser:appgroup /app/scripts ./scripts
COPY --link --chown=appuser:appgroup docker/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh \
    && mkdir -p /app/data/uploads \
    && chown appuser:appgroup /app/data/uploads
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
