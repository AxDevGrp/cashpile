# Pulse Module Environment Variables

# Required for feed ingestion cron job
CRON_SECRET=your-cron-secret-here

# OpenAI API Key (required for AI analysis)
OPENAI_API_KEY=sk-...

# === X/Twitter Integration (Optional but recommended) ===

# X (Twitter) API Bearer Token for ingesting tweets
# Get from: https://developer.twitter.com/en/portal/dashboard
X_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAA...

# X.AI (Grok) API Key for enhanced tweet filtering
# Get from: https://console.x.ai
XAI_API_KEY=xai-...

# === DEPRECATED: MiroFish (No longer needed) ===
# These are no longer used - predictions now use OpenAI directly
# MIROFISH_URL=https://...
# MIROFISH_API_KEY=...
# MIROFISH_WEBHOOK_SECRET=...
