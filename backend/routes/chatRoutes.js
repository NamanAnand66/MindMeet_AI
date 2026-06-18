import { Router } from "express";
import { chatWithArchive } from "../controllers/chatController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const chatRoutes = Router();

chatRoutes.post("/", asyncHandler(chatWithArchive));
