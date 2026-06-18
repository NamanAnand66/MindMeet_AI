import { getSupabase } from "../config/supabase.js";
import { AppError } from "../utils/AppError.js";

export const getAnalytics = async () => {
  const supabase = getSupabase();

  const [{ data: meetings, error: meetingsError }, { data: actionItems, error: actionError }, { data: analytics, error: analyticsError }] =
    await Promise.all([
      supabase.from("meetings").select("id,title,duration_seconds,created_at,status").order("created_at", { ascending: false }),
      supabase.from("action_items").select("id,status,priority,owner"),
      supabase.from("analytics").select("*")
    ]);

  if (meetingsError || actionError || analyticsError) {
    throw new AppError("Failed to load analytics.", 502, meetingsError?.message || actionError?.message || analyticsError?.message);
  }

  const completed = actionItems.filter((item) => item.status?.toLowerCase() === "completed").length;
  const speakingTotals = {};
  const topicTotals = {};

  for (const row of analytics) {
    Object.entries(row.speaking_time_by_speaker ?? {}).forEach(([speaker, seconds]) => {
      speakingTotals[speaker] = Number(((speakingTotals[speaker] ?? 0) + Number(seconds)).toFixed(2));
    });

    (row.recurring_topics ?? []).forEach((topic) => {
      topicTotals[topic] = (topicTotals[topic] ?? 0) + 1;
    });
  }

  return {
    meetingCount: meetings.filter((meeting) => meeting.status === "completed").length,
    totalDurationSeconds: meetings
      .filter((meeting) => meeting.status === "completed")
      .reduce((sum, meeting) => sum + Number(meeting.duration_seconds ?? 0), 0),
    actionCompletionRate: actionItems.length ? Math.round((completed / actionItems.length) * 100) : 0,
    speakingTime: Object.entries(speakingTotals).map(([speaker, seconds]) => ({ speaker, seconds })),
    recurringTopics: Object.entries(topicTotals)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    recentMeetings: meetings.filter((meeting) => meeting.status === "completed").slice(0, 8),
    actionItemsByPriority: ["High", "Medium", "Low"].map((priority) => ({
      priority,
      count: actionItems.filter((item) => item.priority === priority).length
    }))
  };
};
