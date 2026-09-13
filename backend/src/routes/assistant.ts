import { Router } from "express";
import { z } from "zod";
import { currentUser } from "../session.js";
import { askAssistant } from "../assistant.js";
import { asyncHandler } from "../http.js";

export const assistantRouter = Router();

const askBody = z.object({
  question: z.string().trim().min(1).max(300),
});

assistantRouter.post(
  "/ask",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const { question } = askBody.parse(req.body);
    const answer = await askAssistant(question, user.id, user.role);
    res.json(answer);
  }),
);
