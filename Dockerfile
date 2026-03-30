FROM node:20-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@cashpile/web
# Copy static assets into standalone output
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
RUN mkdir -p apps/web/.next/standalone/apps/web/public
RUN if [ -d apps/web/public ]; then cp -r apps/web/public/. apps/web/.next/standalone/apps/web/public/; fi

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Copy the full standalone tree (preserves monorepo node_modules structure)
COPY --from=builder /app/apps/web/.next/standalone ./
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
