import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(uri = env.mongoUri): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
