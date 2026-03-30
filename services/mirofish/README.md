# MiroFish Service — Cashpile Pulse

This directory contains the deployment configuration for the MiroFish multi-agent simulation engine
used by Cashpile's Pulse module.

## What is MiroFish?

[MiroFish](https://github.com/666ghj/MiroFish) is a multi-agent financial simulation framework.
Cashpile uses it to predict market impacts from real-world events ingested from RSS feeds.

## Setup

### 1. Clone MiroFish

```bash
git clone https://github.com/666ghj/MiroFish.git .
```

### 2. Required Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for the simulation agents |
| `PORT` | HTTP port (default: `8000`) |
| `MIROFISH_API_KEY` | Secret key that Cashpile uses to authenticate requests |
| `MIROFISH_WEBHOOK_SECRET` | HMAC-SHA256 secret for signing webhook callbacks |

### 3. API Contract Expected by Cashpile

Cashpile's `mirofish-client.ts` calls these two endpoints:

#### `POST /api/simulate`
**Request:**
```json
{
  "scenario_title": "...",
  "scenario_description": "...",
  "seed_materials": "...",
  "prediction_target": "...",
  "agent_universe": "...",
  "simulation_rounds": 300,
  "callback_url": "https://your-cashpile-app.railway.app/api/pulse/mirofish-webhook",
  "metadata": { "cashpile_event_id": "uuid", "instruments": ["ES", "CL"] }
}
```
**Response:**
```json
{ "job_id": "mf_job_abc123" }
```

#### `GET /api/jobs/:job_id`
**Response:**
```json
{
  "job_id": "mf_job_abc123",
  "status": "complete",
  "simulation_duration_ms": 12400,
  "report_json": {
    "summary": "...",
    "analyst_consensus": "...",
    "risk_factors": ["...", "..."],
    "instrument_impacts": [
      {
        "instrument": "ES",
        "direction": "bearish",
        "magnitude_pct": 1.2,
        "confidence": 0.78,
        "time_horizon": "1d",
        "rationale": "..."
      }
    ],
    "simulation_rounds": 300,
    "generated_at": "2026-03-30T10:00:00Z"
  }
}
```

#### Webhook callback (`POST callback_url`)
When a simulation completes, MiroFish must POST to the `callback_url` provided at job submission:
```json
{
  "job_id": "mf_job_abc123",
  "status": "complete",
  "report": { ...same as report_json above... }
}
```
Include the header: `x-mirofish-signature: <HMAC-SHA256 hex of raw body using MIROFISH_WEBHOOK_SECRET>`

### 4. Wiring back into Cashpile

Once deployed, set these in your Cashpile `apps/web` environment:

```
MIROFISH_URL=https://your-mirofish-service.railway.app
MIROFISH_API_KEY=<your chosen secret>
MIROFISH_WEBHOOK_SECRET=<shared HMAC secret>
```

## Railway Deployment

1. Create a new Railway service pointing to this directory
2. Set all env vars above
3. Railway will auto-detect the `Dockerfile` and build/deploy
4. Note the public domain and set `MIROFISH_URL` in the Cashpile web service

## Cron (feed ingestion)

In Railway, add a cron job on the **Cashpile web** service:
- **Schedule:** `*/15 * * * *` (every 15 minutes)
- **Command:** `curl -X POST https://your-cashpile-app.railway.app/api/pulse/ingest-feeds -H "Authorization: Bearer $CRON_SECRET"`
