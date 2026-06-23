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
    sessionsChange: number | null;
    users: number;
    usersChange: number | null;
    pageviews: number;
    pageviewsChange: number | null;
    avgSessionDuration: number;
    avgSessionDurationChange: number | null;
    bounceRate: number;
    bounceRateChange: number | null;
    engagementRate: number;
    engagementRateChange: number | null;
    connected: boolean;
  };
  searchConsole: {
    impressions: number;
    impressionsChange: number | null;
    clicks: number;
    clicksChange: number | null;
    ctr: number;
    ctrChange: number | null;
    avgPosition: number;
    avgPositionChange: number | null;
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
  sentChange: number | null;
  opens: number;
  opensChange: number | null;
  replies: number;
  repliesChange: number | null;
  openRate: number;
  openRateChange: number | null;
  replyRate: number;
  replyRateChange: number | null;
  connected: boolean;
}

export interface OutreachMetrics {
  lemlist: OutreachChannelStats;
  smartlead: OutreachChannelStats;
  combined: OutreachChannelStats;
  trend: TrendPoint[];
}

export interface CrmMetrics {
  dealsCreated: number;
  dealsCreatedChange: number | null;
  dealsWon: number;
  dealsWonChange: number | null;
  dealsWonValue: number;
  dealsWonValueChange: number | null;
  dealsLost: number;
  dealsLostChange: number | null;
  winRate: number;
  winRateChange: number | null;
  openDeals: number;
  openDealsValue: number;
  mqls: number;
  mqlsChange: number | null;
  mqlStageName: string | null;
  sqls: number;
  sqlsChange: number | null;
  sqlStageName: string | null;
  qualifyingThreshold: string | null;
  trend: TrendPoint[];
  connected: boolean;
}

export interface SocialChannelStats {
  service: string;
  channelName: string;
  posts: number;
  postsChange: number | null;
  impressions: number;
  impressionsChange: number | null;
  reach: number;
  reachChange: number | null;
  engagement: number;
  engagementChange: number | null;
  engagementRate: number;
  engagementRateChange: number | null;
}

export interface SocialTopPost {
  id: string;
  text: string;
  service: string;
  channelName: string;
  sentAt: string;
  impressions: number;
  engagement: number;
}

export interface SocialMetrics {
  connected: boolean;
  channels: SocialChannelStats[];
  topPosts: SocialTopPost[];
  trend: TrendPoint[];
  totals: {
    posts: number;
    postsChange: number | null;
    impressions: number;
    impressionsChange: number | null;
    reach: number;
    reachChange: number | null;
    engagement: number;
    engagementChange: number | null;
  };
}

export interface ExecutiveSummary {
  website: WebsiteMetrics;
  outreach: OutreachMetrics;
  crm: CrmMetrics;
  social: SocialMetrics;
  generatedAt: string;
}
