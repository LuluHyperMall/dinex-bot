# Dinex Bot — production container (Next.js custom server + Socket.IO + SQLite)
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL is needed by Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install ALL deps incl. dev — tsx (runtime), prisma CLI, next, tailwind, etc.
# live in devDependencies and are needed to build AND run, so force --include=dev
# even though NODE_ENV=production (which would otherwise skip them).
COPY package.json package-lock.json* ./
RUN npm ci --include=dev || npm install --include=dev

# Copy source
COPY . .

# Generate Prisma client + build Next
ENV DATABASE_URL="file:/data/dev.db"
RUN npx prisma generate && npm run build

# Persistent SQLite lives in /data (mount a volume here on your host)
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

# Push schema + seed-if-empty, then start the server
CMD ["npm", "run", "start:cloud"]
