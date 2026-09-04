FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
COPY migrations ./migrations
COPY fixtures ./fixtures
COPY station.config.ts tsconfig.json ./
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @station/cockpit build
EXPOSE 19173
ENV STATION_COCKPIT_PORT=19173
ENV STATION_WORKER_PORT=19174
CMD ["pnpm", "dev"]
