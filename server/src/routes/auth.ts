import { Router } from "express";
import { loginHandler, logoutHandler, meHandler, registerHandler } from "../controllers/authController.js";
import { requireAuth } from "../lib/auth.js";
import { createProcessRateLimit } from "../middleware/boundedLimits.js";

export const authRouter = Router();

const authAttemptLimit = () => createProcessRateLimit({ limit: 30, windowMs: 15 * 60_000 });
authRouter.post("/register", authAttemptLimit(), registerHandler);
authRouter.post("/login", authAttemptLimit(), loginHandler);
authRouter.post("/logout", requireAuth, logoutHandler);
authRouter.get("/me", requireAuth, meHandler);
