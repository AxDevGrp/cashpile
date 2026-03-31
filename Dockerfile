FROM node:20-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app

# Build-time env vars for Next.js public vars
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@cashpile/web --force
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
RUN mkdir -p apps/web/.next/standalone/apps/web/public
RUN if [ -d apps/web/public ]; then cp -r apps/web/public/. apps/web/.next/standalone/apps/web/public/; fi

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
COPY --from=builder /app/apps/web/.next/standalone ./
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
