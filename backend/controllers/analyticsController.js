import { getAnalytics } from "../services/analyticsService.js";

export const getAnalyticsDashboard = async (_req, res) => {
  const analytics = await getAnalytics();
  res.json({ success: true, data: analytics });
};
