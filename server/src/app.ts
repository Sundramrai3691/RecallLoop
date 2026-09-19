import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter);
  app.use(errorHandler);
  return app;
}
