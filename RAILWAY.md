# ============================================================
# Railway Deployment — Cashpile.ai
# One project, two services: cashpile-web + cashpile-mirofish
# ============================================================

# cashpile-web (Next.js)
# ---------------------
# Build command:  pnpm turbo build --filter=@cashpile/web
# Start command:  node apps/web/.next/standalone/server.js
# Root directory: /
# Watch paths:    apps/web, packages

# cashpile-mirofish (Python)
# --------------------------
# Source:         apps/mirofish/
# Build command:  pip install -r requirements.txt
# Start command:  python backend/start.py
# Port:           5001
# Internal URL:   http://cashpile-mirofish.railway.internal:5001

# Shared environment variables (set in Railway project):
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENAI_API_KEY
# - OPENAI_MODEL
# - MIROFISH_API_URL=http://cashpile-mirofish.railway.internal:5001
# - NEWSAPI_KEY
# - POLYGON_API_KEY
# - FRED_API_KEY
# - ALPHAVANTAGE_API_KEY
# - STRIPE_SECRET_KEY
# - STRIPE_WEBHOOK_SECRET
# - ZEP_API_KEY
