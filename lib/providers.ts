import type { Provider } from "@prisma/client";

export type AuthMode = "google_oauth" | "api_key";

export interface ProviderConfig {
  id: Provider;
  label: string;
  description: string;
  authMode: AuthMode;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  GA4: {
    id: "GA4",
    label: "Google Analytics 4",
    description: "Sessions, users, pageviews and engagement from your website.",
    authMode: "google_oauth",
  },
  SEARCH_CONSOLE: {
    id: "SEARCH_CONSOLE",
    label: "Google Search Console",
    description: "Search impressions, clicks, CTR and average position.",
    authMode: "google_oauth",
  },
  LEMLIST: {
    id: "LEMLIST",
    label: "Lemlist",
    description: "Outbound emails sent, opens, replies and reply rate.",
    authMode: "api_key",
  },
  SMARTLEAD: {
    id: "SMARTLEAD",
    label: "Smartlead",
    description: "Outbound emails sent, opens, replies and reply rate.",
    authMode: "api_key",
  },
  PIPEDRIVE: {
    id: "PIPEDRIVE",
    label: "Pipedrive",
    description: "Deals created, won, lost, win rate and open pipeline value.",
    authMode: "api_key",
  },
  BUFFER: {
    id: "BUFFER",
    label: "Buffer",
    description: "Social post performance across LinkedIn, Instagram and other connected channels.",
    authMode: "api_key",
  },
};

export const PROVIDER_LIST: ProviderConfig[] = [
  PROVIDERS.GA4,
  PROVIDERS.SEARCH_CONSOLE,
  PROVIDERS.LEMLIST,
  PROVIDERS.SMARTLEAD,
  PROVIDERS.PIPEDRIVE,
  PROVIDERS.BUFFER,
];

export function isProvider(v: string): v is Provider {
  return v in PROVIDERS;
}
