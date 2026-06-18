export interface MetricSection<T> {
  connected: boolean;
  data: T | null;
  error?: string;
}

export interface TrendPoint {
  date: string;
  [key: string]: string | number;
}

export interface WebsiteMetrics {
  ga4: {
    sessions: number;
    users: number;
    pageviews: number;
    avgSessionDuration: number;
    bounceRate: number;
    engagementRate: number;
    connected: boolean;
  };
  searchConsole: {
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
    connected: boolean;
  };
  trend: TrendPoint[];
}

export interface OutreachChannelStats {
  sent: number;
  opens: number;
  replies: number;
  openRate: number;
  replyRate: number;
  connected: boolean;
}

export interface OutreachMetrics {
  lemlist: OutreachChannelStats;
  smartlead: OutreachChannelStats;
  combined: OutreachChannelStats;
  trend: TrendPoint[];
}

export interface CrmMetrics {
  mqls: number;
  sqls: number;
  meetings: number;
  deals: number;
  dealsValue: number;
  connected: boolean;
}

export interface SocialPost {
  network: "linkedin" | "instagram";
  date: string;
  text: string;
  impressions: number;
  engagement: number;
  engagementRate: number;
}

export interface SocialChannelStats {
  totalImpressions: number;
  totalEngagement: number;
  avgEngagementRate: number;
  posts: SocialPost[];
  connected: boolean;
}

export interface SocialMetrics {
  linkedin: SocialChannelStats;
  instagram: SocialChannelStats;
  trend: TrendPoint[];
}

export interface ExecutiveSummary {
  website: WebsiteMetrics;
  outreach: OutreachMetrics;
  crm: CrmMetrics;
  social: SocialMetrics;
  generatedAt: string;
}
