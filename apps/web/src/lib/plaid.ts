import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export const PLAID_ENV = process.env.PLAID_ENV ?? "sandbox";

function csv(name: string, fallback: readonly string[]) {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getPlaidConfigStatus() {
  const validEnv = PLAID_ENV in PlaidEnvironments;
  return {
    env: PLAID_ENV,
    validEnv,
    hasClientId: Boolean(process.env.PLAID_CLIENT_ID),
    hasSecret: Boolean(process.env.PLAID_SECRET),
    hasWebhookUrl: Boolean(process.env.PLAID_WEBHOOK_URL),
    products: PLAID_PRODUCTS,
    countryCodes: PLAID_COUNTRY_CODES,
    ready: validEnv && Boolean(process.env.PLAID_CLIENT_ID) && Boolean(process.env.PLAID_SECRET),
  };
}

export function assertPlaidConfigured() {
  const status = getPlaidConfigStatus();
  if (!status.validEnv) {
    throw new Error(`Invalid PLAID_ENV "${PLAID_ENV}". Expected sandbox, development, or production.`);
  }
  if (!status.hasClientId || !status.hasSecret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET are required to use Plaid.");
  }
}

const config = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
      "PLAID-SECRET":    process.env.PLAID_SECRET ?? "",
    },
  },
});

export const plaidClient = new PlaidApi(config);

export const PLAID_PRODUCTS = csv("PLAID_PRODUCTS", ["transactions"]);
export const PLAID_COUNTRY_CODES = csv("PLAID_COUNTRY_CODES", ["US"]);
