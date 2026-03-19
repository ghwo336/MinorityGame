FROM node:20-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app

# Copy workspace root files for pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./frontend/

# Accept build-time env vars
ARG NEXT_PUBLIC_API_URL=http://localhost:8090/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
ENV NEXT_PUBLIC_CONTRACT_ADDRESS=$NEXT_PUBLIC_CONTRACT_ADDRESS

# Build Next.js (standalone output)
RUN pnpm --filter frontend build

# --- Production ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone build output
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3010
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

CMD ["node", "frontend/server.js"]
