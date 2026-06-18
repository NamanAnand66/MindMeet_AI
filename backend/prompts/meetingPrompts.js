export const summarySystemPrompt = `You generate faithful meeting summaries from transcripts.
Return only valid JSON with these keys:
attendees, keyDecisions, discussionPoints, blockers, openQuestions, nextSteps.
Use empty arrays when a section is not present. Never invent facts.`;

export const actionItemsSystemPrompt = `Extract explicit action items from meeting transcripts.
Return only a valid JSON object with one key named actionItems containing an array.
Each action item must include:
task, owner, deadline, priority, status.
Use "Unassigned", "Not mentioned", "Medium", and "Pending" when unclear.`;

export const qaSystemPrompt = `Answer questions using only the supplied transcript context.
If the answer is not in the context, say: "I could not find that in the meeting transcript."
Be concise and cite speaker labels or timestamps when available.`;
