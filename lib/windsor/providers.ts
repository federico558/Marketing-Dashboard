import type { Provider } from "@prisma/client";

export interface ProviderConfig {
  id: Provider;
  label: string;
  description: string;
  windsorConnectorSlug: string;
  fields: string[];
  dateField?: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  GA4: {
    id: "GA4",
    label: "Google Analytics 4",
    description: "Sessions, users, pageviews and engagement from your website.",
    windsorConnectorSlug: "googleanalytics4",
    fields: [
      "date",
      "sessions",
      "totalUsers",
      "screenPageViews",
      "averageSessionDuration",
      "bounceRate",
      "engagementRate",
    ],
    dateField: "date",
  },
  SEARCH_CONSOLE: {
    id: "SEARCH_CONSOLE",
    label: "Google Search Console",
    description: "Search impressions, clicks, CTR and average position.",
    windsorConnectorSlug: "searchconsole",
    fields: ["date", "impressions", "clicks", "ctr", "position"],
    dateField: "date",
  },
  LINKEDIN: {
    id: "LINKEDIN",
    label: "LinkedIn",
    description: "Organic post impressions and engagement.",
    windsorConnectorSlug: "linkedin_organic",
    fields: [
      "date",
      "post_id",
      "post_text",
      "impressions",
      "likes",
      "comments",
      "shares",
      "engagement_rate",
    ],
    dateField: "date",
  },
  INSTAGRAM: {
    id: "INSTAGRAM",
    label: "Instagram",
    description: "Organic post impressions and engagement.",
    windsorConnectorSlug: "instagram_public",
    fields: [
      "date",
      "post_id",
      "caption",
      "impressions",
      "likes",
      "comments",
      "saves",
      "engagement_rate",
    ],
    dateField: "date",
  },
  LEMLIST: {
    id: "LEMLIST",
    label: "Lemlist",
    description: "Outbound emails sent, opens, replies and reply rate.",
    windsorConnectorSlug: "lemlist",
    fields: [
      "date",
      "campaign_name",
      "emails_sent",
      "emails_opened",
      "emails_replied",
      "open_rate",
      "reply_rate",
    ],
    dateField: "date",
  },
  SMARTLEAD: {
    id: "SMARTLEAD",
    label: "Smartlead",
    description: "Outbound emails sent, opens, replies and reply rate.",
    windsorConnectorSlug: "smartlead",
    fields: [
      "date",
      "campaign_name",
      "sent_count",
      "open_count",
      "reply_count",
      "open_rate",
      "reply_rate",
    ],
    dateField: "date",
  },
  PIPEDRIVE: {
    id: "PIPEDRIVE",
    label: "Pipedrive",
    description: "MQLs, SQLs, meetings booked and deals won.",
    windsorConnectorSlug: "pipedrive",
    fields: [
      "date",
      "stage_name",
      "deal_count",
      "deal_value",
      "deal_status",
      "activity_type",
      "activity_count",
    ],
    dateField: "date",
  },
};

export const PROVIDER_LIST: ProviderConfig[] = [
  PROVIDERS.GA4,
  PROVIDERS.SEARCH_CONSOLE,
  PROVIDERS.LEMLIST,
  PROVIDERS.SMARTLEAD,
  PROVIDERS.PIPEDRIVE,
  PROVIDERS.LINKEDIN,
  PROVIDERS.INSTAGRAM,
];

export function providerFromSlug(slug: string): Provider | null {
  for (const p of Object.values(PROVIDERS)) {
    if (p.windsorConnectorSlug === slug) return p.id;
  }
  return null;
}
