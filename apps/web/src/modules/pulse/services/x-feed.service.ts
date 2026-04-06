/**
 * X/Twitter Feed Service — ingests tweets from key financial accounts
 * Uses X.AI (Grok) API for enhanced tweet analysis
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeEventFromText } from "@cashpile/ai/pulse";
import type { FeedIngestionResult } from "../types";

// Key financial accounts to monitor
const X_FINANCIAL_ACCOUNTS = [
  // News & Wires
  "@Reuters",
  "@Bloomberg",
  "@FinancialTimes",
  "@WSJ",
  "@CNBC",
  "@MarketWatch",
  "@KitcoNewsNOW",

  // Fed & Policy
  "@federalreserve",
  "@neelkashkari",
  "@MaryDalyEcon",

  // Traders & Analysts
  "@zerohedge",
  "@RampCapitalLLC",
  "@biancoresearch",
  "@LizAnnSonders",
  "@michaeljburry",

  // Politicians (market-moving statements)
  "@realDonaldTrump",
  "@POTUS",
  "@SecYellen",

  // Crypto/Alternative
  "@elonmusk",
];

// X API v2 endpoints
const X_API_BASE = "https://api.twitter.com/2";

interface XTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
}

interface XUser {
  id: string;
  username: string;
  name: string;
}

interface XSearchResponse {
  data?: XTweet[];
  includes?: {
    users?: XUser[];
  };
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
  };
}

/**
 * Fetch recent tweets from specific users
 */
async function fetchUserTweets(
  username: string,
  bearerToken: string,
  sinceId?: string
): Promise<XTweet[]> {
  // First get user ID
  const userRes = await fetch(
    `${X_API_BASE}/users/by/username/${username.replace("@", "")}`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
    }
  );

  if (!userRes.ok) {
    console.error(`Failed to fetch user ${username}:`, await userRes.text());
    return [];
  }

  const user = (await userRes.json()) as { data?: { id: string } };
  if (!user.data?.id) return [];

  // Fetch recent tweets
  const tweetsUrl = new URL(`${X_API_BASE}/users/${user.data.id}/tweets`);
  tweetsUrl.searchParams.set("max_results", "10");
  tweetsUrl.searchParams.set("tweet.fields", "created_at,public_metrics");
  tweetsUrl.searchParams.set("exclude", "retweets,replies");
  if (sinceId) tweetsUrl.searchParams.set("since_id", sinceId);

  const tweetsRes = await fetch(tweetsUrl.toString(), {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!tweetsRes.ok) {
    console.error(`Failed to fetch tweets for ${username}:`, await tweetsRes.text());
    return [];
  }

  const data = (await tweetsRes.json()) as XSearchResponse;
  return data.data ?? [];
}

/**
 * Search X for financial keywords using X.AI (Grok) enhanced search
 */
async function searchFinancialTweets(
  bearerToken: string,
  grokApiKey?: string
): Promise<XTweet[]> {
  // Standard X API search (Basic+ tiers)
  const searchQueries = [
    "(Fed OR FOMC OR CPI OR jobs report) -is:retweet lang:en",
    "(oil OR crude OR OPEC OR Hormuz) -is:retweet lang:en",
    "(NASDAQ OR IPO OR listing OR SPAC) -is:retweet lang:en",
    "(tariff OR trade war OR sanctions) -is:retweet lang:en",
  ];

  const allTweets: XTweet[] = [];

  for (const query of searchQueries) {
    const url = new URL(`${X_API_BASE}/tweets/search/recent`);
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", "25");
    url.searchParams.set("tweet.fields", "created_at,public_metrics,author_id");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!res.ok) {
      console.error("X search failed:", await res.text());
      continue;
    }

    const data = (await res.json()) as XSearchResponse;
    if (data.data) allTweets.push(...data.data);
  }

  // If Grok API key provided, use X.AI for enhanced analysis
  if (grokApiKey && allTweets.length > 0) {
    return enhanceWithGrok(allTweets, grokApiKey);
  }

  return allTweets;
}

/**
 * Use X.AI (Grok) to filter and rank tweets by market relevance
 */
async function enhanceWithGrok(
  tweets: XTweet[],
  grokApiKey: string
): Promise<XTweet[]> {
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${grokApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content:
              "You are a financial news curator. Given a list of tweets, return ONLY the IDs of tweets that are likely to move financial markets. Return as JSON array of tweet IDs.",
          },
          {
            role: "user",
            content: `Tweets:\n${tweets
              .map((t) => `- ID: ${t.id}, Text: ${t.text.slice(0, 200)}`)
              .join("\n")}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return tweets;

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { tweet_ids?: string[] };

    if (parsed.tweet_ids?.length) {
      const relevantIds = new Set(parsed.tweet_ids);
      return tweets.filter((t) => relevantIds.has(t.id));
    }
  } catch (err) {
    console.error("Grok enhancement failed:", err);
  }

  return tweets;
}

/**
 * Main ingestion function — call from API route
 */
export async function ingestXFeeds(
  supabase: SupabaseClient,
  options: {
    xBearerToken: string;
    grokApiKey?: string;
    sinceId?: string;
  }
): Promise<FeedIngestionResult & { lastTweetId?: string }> {
  let ingested = 0;
  let skipped = 0;
  let errors = 0;
  let lastTweetId: string | undefined;

  // Fetch from key accounts
  const accountPromises = X_FINANCIAL_ACCOUNTS.map((account) =>
    fetchUserTweets(account, options.xBearerToken, options.sinceId)
  );

  // Fetch from search
  accountPromises.push(
    searchFinancialTweets(options.xBearerToken, options.grokApiKey)
  );

  const results = await Promise.allSettled(accountPromises);
  const allTweets: XTweet[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allTweets.push(...result.value);
    } else {
      console.error("X feed fetch failed:", result.reason);
      errors++;
    }
  }

  // Deduplicate by ID
  const seenIds = new Set<string>();
  const uniqueTweets = allTweets.filter((t) => {
    if (seenIds.has(t.id)) return false;
    seenIds.add(t.id);
    return true;
  });

  // Sort by recency
  uniqueTweets.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (uniqueTweets.length > 0) {
    lastTweetId = uniqueTweets[0].id;
  }

  // Process each tweet
  for (const tweet of uniqueTweets) {
    // Skip if already ingested
    const { data: existing } = await supabase
      .from("pulse_events")
      .select("id")
      .eq("source_url", `https://twitter.com/i/web/status/${tweet.id}`)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Skip low-engagement tweets (likely not market-moving)
    const engagement =
      (tweet.public_metrics?.retweet_count || 0) +
      (tweet.public_metrics?.like_count || 0);
    if (engagement < 50) {
      skipped++;
      continue;
    }

    // Analyze with AI
    try {
      const analyzed = await analyzeEventFromText(
        tweet.text,
        "X/Twitter"
      );

      // Only ingest if severity is medium+ or has market instruments
      if (
        analyzed.severity === "low" &&
        analyzed.affected_instruments.length === 0
      ) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase
        .from("pulse_events")
        .insert({
          title: analyzed.title,
          summary: analyzed.summary,
          category: analyzed.category,
          severity: analyzed.severity,
          affected_instruments: analyzed.affected_instruments,
          source: "X/Twitter",
          source_url: `https://twitter.com/i/web/status/${tweet.id}`,
          raw_content: tweet.text,
          published_at: tweet.created_at,
          dedup_hash: tweet.id,
        });

      if (insertError) {
        if (!insertError.message.includes("duplicate")) {
          console.error("Insert failed:", insertError.message);
          errors++;
        } else {
          skipped++;
        }
        continue;
      }

      ingested++;
    } catch (err) {
      console.error("AI analysis failed for tweet:", tweet.id, err);
      errors++;
    }
  }

  return { ingested, skipped, errors, triggered_predictions: 0, lastTweetId };
}
