# ===========================
# Stage 1 - Dependencies
# ===========================
FROM node:20-alpine AS dependencies

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# ===========================
# Stage 2 - Build
# ===========================
FROM dependencies AS builder

WORKDIR /app

COPY . .

RUN pnpm build

# ===========================
# Stage 3 - Production
# ===========================
FROM node:20-alpine AS production

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]