# Frontend image: Next.js 16 built to a standalone server bundle (see next.config.ts output mode).
# Multi-stage so the runtime image carries only the traced server + static assets, not the full
# node_modules or build toolchain.
#
# Uses the Debian (glibc) node image rather than alpine: package-lock.json is resolved on glibc, and
# `npm ci` is strict about the platform-specific optional native deps (e.g. @emnapi/*), so the build
# platform must match the one the lockfile was generated on.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nextjs

# The standalone bundle includes a minimal server.js plus only the node_modules it traced. Static
# assets and public files are not copied by server.js automatically, so place them where it serves.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
