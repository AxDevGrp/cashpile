import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CRON_SECRET_HEADER,
  interpretTransactionsOnce,
  isAuthorizedCronRequest,
} from "@/lib/interpretation-worker";

// One bounded claim/run per invocation; the deployment scheduler calls this
// once a minute. No recursive drain and no browser/user input.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req.headers.get(CRON_SECRET_HEADER), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const aiEnabled = process.env.CASHPILE_BACKGROUND_AI_ENABLED === "true";

  try {
    const result = await interpretTransactionsOnce({ serviceClient, aiEnabled });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/interpret-transactions]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "worker_failed" }, { status: 500 });
  }
}
