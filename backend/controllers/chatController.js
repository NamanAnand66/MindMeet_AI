import { searchArchive } from "../services/ragService.js";

export const chatWithArchive = async (req, res) => {
  const result = await searchArchive({
    question: req.body.question,
    meetingId: req.body.meetingId || null
  });

  res.json({ success: true, data: result });
};
