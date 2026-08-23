# ---------------------------------------------------------
# Base
# ---------------------------------------------------------
FROM node:20-slim AS base

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*


# ---------------------------------------------------------
# Dependencies + generated Prisma client
# ---------------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json* ./

RUN npm ci

# Prisma generate needs the schema available.
COPY prisma ./prisma

RUN npx prisma generate


# ---------------------------------------------------------
# Build
# ---------------------------------------------------------
FROM deps AS build

COPY . .

RUN npm run build


# ---------------------------------------------------------
# API
# ---------------------------------------------------------
FROM base AS api

ENV NODE_ENV=production

# IMPORTANT:
# Copy node_modules from BUILD, not DEPS.
# Prisma Client was generated in the deps stage
# and inherited by build.
COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 3000

CMD ["node", "dist/src/server.js"]


# ---------------------------------------------------------
# Worker
# ---------------------------------------------------------
FROM base AS worker

ENV NODE_ENV=production

# Same generated Prisma Client as API.
COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

CMD ["node", "dist/worker/worker.js"]
