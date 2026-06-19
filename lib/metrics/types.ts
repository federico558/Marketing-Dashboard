export interface TrendPoint {
  date: string;
  [key: string]: string | number;
}

export interface BreakdownRow {
  label: string;
  value: number;
  changePercent: number | null;
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
  breakdowns: {
    byCountry: BreakdownRow[];
    byPage: BreakdownRow[];
    byChannel: BreakdownRow[];
  };
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

export interface ExecutiveSummary {
  website: WebsiteMetrics;
  outreach: OutreachMetrics;
  generatedAt: string;
}
