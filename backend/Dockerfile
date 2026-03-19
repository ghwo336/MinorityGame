FROM node:20-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app

# Copy workspace root files for pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

# Copy backend source
COPY backend/ ./backend/

# Build (prisma generate + tsc)
RUN pnpm --filter minority-game-backend build

# --- Production ---
FROM node:20-alpine AS runner
RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --prod

# Copy build output and generated prisma client
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/src/generated ./backend/src/generated
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/prisma.config.ts ./backend/prisma.config.ts

WORKDIR /app/backend

EXPOSE 8090
ENV PORT=8090

CMD ["node", "dist/index.js"]
