/**
 * Feed Service — ingests RSS feeds from Reuters, Yahoo Finance, and Investing.com
 * Deduplicates by SHA-256 hash of (title + source), runs AI analysis, inserts into pulse_events.
 */

import { createHash } from "crypto";
import Parser from "rss-parser";
import { analyzeEventFromText } from "@cashpile/ai/pulse";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedIngestionResult } from "../types";

const RSS_FEEDS = [
  {
    name: "Reuters",
    url:
      process.env.REUTERS_RSS_URL ??
      "https://feeds.reuters.com/reuters/businessNews",
  },
  {
    name: "Yahoo Finance",
    url:
      process.env.YAHOO_FINANCE_RSS_URL ??
      "https://finance.yahoo.com/news/rssindex",
  },
  {
    name: "Investing.com",
    url:
      process.env.INVESTING_RSS_URL ??
      "https://www.investing.com/rss/news.rss",
  },
];

export function buildDedupHash(title: string, source: string): string {
  return createHash("sha256")
    .update(`${title.trim().toLowerCase()}::${source.toLowerCase()}`)
    .digest("hex");
}

interface RawFeedItem {
  title?: string;
  contentSnippet?: string;
  content?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
}

export async function fetchRssFeed(url: string): Promise<RawFeedItem[]> {
  const parser = new Parser({ timeout: 10000 });
  const feed = await parser.parseURL(url);
  return feed.items as RawFeedItem[];
}

export async function ingestAllFeeds(
  supabase: SupabaseClient
): Promise<FeedIngestionResult> {
  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  const feedResults = await Promise.allSettled(
    RSS_FEEDS.map((feed) => fetchRssFeed(feed.url).then((items) => ({ feed, items })))
  );

  for (const result of feedResults) {
    if (result.status === "rejected") {
      console.error("Feed fetch failed:", result.reason);
      errors++;
      continue;
    }

    const { feed, items } = result.value;

    for (const item of items) {
      const title = item.title?.trim();
      if (!title) continue;

      const dedupHash = buildDedupHash(title, feed.name);

      // Check for existing event
      const { data: existing } = await supabase
        .from("pulse_events")
        .select("id")
        .eq("dedup_hash", dedupHash)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Analyze with AI
      const rawText = [title, item.contentSnippet ?? item.content ?? ""].join("\n\n");
      let analyzed;
      try {
        analyzed = await analyzeEventFromText(rawText, feed.name);
      } catch (err) {
        console.error("AI analysis failed for:", title, err);
        errors++;
        continue;
      }

      const publishedAt =
        item.isoDate ?? item.pubDate
          ? new Date(item.isoDate ?? item.pubDate!).toISOString()
          : new Date().toISOString();

      const { error: insertError } = await supabase.from("pulse_events").insert({
        title: analyzed.title,
        summary: analyzed.summary,
        category: analyzed.category,
        severity: analyzed.severity,
        affected_instruments: analyzed.affected_instruments,
        source: feed.name,
        source_url: item.link ?? null,
        raw_content: rawText.slice(0, 5000),
        published_at: publishedAt,
        dedup_hash: dedupHash,
      });

      if (insertError) {
        // Conflict on dedup_hash is acceptable (race condition)
        if (!insertError.message.includes("duplicate")) {
          console.error("Insert failed:", insertError.message);
          errors++;
        } else {
          skipped++;
        }
        continue;
      }

      ingested++;
    }
  }

  return { ingested, skipped, errors, triggered_predictions: 0 };
}
