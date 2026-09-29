import { Router } from "express";
import { loginHandler, logoutHandler, meHandler, registerHandler } from "../controllers/authController.js";
import { requireAuth } from "../lib/auth.js";

export const authRouter = Router();

authRouter.post("/register", registerHandler);
authRouter.post("/login", loginHandler);
authRouter.post("/logout", requireAuth, logoutHandler);
authRouter.get("/me", requireAuth, meHandler);
