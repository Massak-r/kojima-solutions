import { apiFetch } from './client';

export interface AnalyticsData {
  visitors: number;
  pageviews: number;
  topPages: { path: string; count: number }[];
  topReferrers: { domain: string; count: number }[];
  funnelConversion: { starts: number; completes: number; rate: number };
  daily: { date: string; visitors: number; pageviews: number }[];
}

export function getAnalytics(period = '7d') {
  return apiFetch<AnalyticsData>(`analytics.php?period=${period}`);
}
