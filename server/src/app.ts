import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";
import { requestTelemetry } from "./middleware/requestTelemetry.js";
import { securityHeaders } from "./middleware/securityHeaders.js";

export function createApp() {
  const app = express();
  if (env.trustProxyHops > 0) app.set("trust proxy", env.trustProxyHops);
  app.use(securityHeaders);
  app.use(cors({ origin: env.clientOrigin }));
  app.use(requestTelemetry);
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter);
  app.use(errorHandler);
  return app;
}
