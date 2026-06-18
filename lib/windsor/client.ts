import { PROVIDERS } from "./providers";
import type { Provider } from "@prisma/client";

const BASE = (process.env.WINDSOR_API_BASE ?? "https://windsor.ai/api").replace(/\/+$/, "");
const ONBOARD_BASE = (
  process.env.WINDSOR_ONBOARD_BASE ?? "https://onboard.windsor.ai"
).replace(/\/+$/, "");

export interface WindsorQuery {
  connector: string;
  fields: string[];
  date_from: string;
  date_to: string;
  account_id?: string;
}

export interface WindsorAuthRequest {
  connector: string;
  redirect_uri: string;
  state: string;
}

/**
 * Minimal client for the Windsor.ai public API.
 * Docs: https://windsor.ai/api
 * The shape is intentionally permissive — Windsor returns
 * `{ data: Array<Record<string, unknown>> }` and we normalize per-provider.
 */
export class WindsorClient {
  constructor(private apiKey = process.env.WINDSOR_API_KEY ?? "") {
    if (!this.apiKey && process.env.NODE_ENV === "production") {
      console.warn("[windsor] WINDSOR_API_KEY is not set");
    }
  }

  private url(path: string, params: Record<string, string | undefined> = {}) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${BASE}${normalized}`);
    url.searchParams.set("api_key", this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
    return url.toString();
  }

  async getAuthorizationUrl(input: WindsorAuthRequest): Promise<string> {
    const url = new URL(`${ONBOARD_BASE}/`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("data_source", input.connector);
    url.searchParams.set("_redirect", input.redirect_uri);
    url.searchParams.set("state", input.state);
    return url.toString();
  }

  async getData(query: WindsorQuery): Promise<Array<Record<string, unknown>>> {
    const url = this.url("/", {
      connector: query.connector,
      fields: query.fields.join(","),
      date_from: query.date_from,
      date_to: query.date_to,
      account_id: query.account_id,
    });
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(
        `Windsor getData(${query.connector}) failed: ${res.status}`,
      );
    }
    const json = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    return json.data ?? [];
  }
}

export const windsor = new WindsorClient();

export function fieldsForProvider(provider: Provider): string[] {
  return PROVIDERS[provider].fields;
}

export function connectorSlugFor(provider: Provider): string {
  return PROVIDERS[provider].windsorConnectorSlug;
}
