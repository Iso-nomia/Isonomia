# mesh-lite/api/Dockerfile
# ── deps ────────────────────────────────────────────────────────────
FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ───────────────────────────────────────────────────────────
FROM node:20-bullseye-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY prisma ./prisma
# Generate Prisma Client (minimal schema; raw SQL usage is fine)
RUN npx prisma generate
# Copy source and build to dist/
COPY server.ts ./server.ts
RUN npm run build

# ── runtime ─────────────────────────────────────────────────────────
FROM node:20-bullseye-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
# Install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Bring in prisma client that was generated during build
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
# App code
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["node", "dist/server.js"]
