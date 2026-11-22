import type { NextFunction, Response } from "express";
import { createHash } from "node:crypto";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { serializeAttempt } from "../lib/serialize.js";
import {
  abandonSprint,
  completeSprint,
  getActiveSprint,
  getSprint,
  openSprintRepair,
  startSprint,
  startSprintVerification,
} from "../services/sprint/sprintService.js";

export async function getActiveSprintHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ sprint: await getActiveSprint(req.user!.id) }); } catch (error) { next(error); }
}

export async function startSprintHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestBody=req.body ?? {};
    const canonicalBody=Object.fromEntries(Object.keys(requestBody).sort().map((key)=>[key,requestBody[key]]));
    const requestHash=createHash("sha256").update(JSON.stringify(canonicalBody)).digest("hex");
    const sprint = await startSprint(req.user!.id, req.body?.idempotencyKey, requestHash);
    res.status(sprint.status === "in_progress" ? 201 : 200).json({ sprint });
  } catch (error) { next(error); }
}

export async function getSprintHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ sprint: await getSprint(req.user!.id, req.params.id) }); } catch (error) { next(error); }
}

export async function completeSprintHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ sprint: await completeSprint(req.user!.id, req.params.id) }); } catch (error) { next(error); }
}

export async function abandonSprintHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ sprint: await abandonSprint(req.user!.id, req.params.id) }); } catch (error) { next(error); }
}

export async function openSprintRepairHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await openSprintRepair(req.user!.id, req.params.id);
    res.json({ sprint: result.sprint, remediation: result.remediation });
  } catch (error) { next(error); }
}

export async function startSprintVerificationHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await startSprintVerification(req.user!.id, req.params.id);
    res.json({ sprint: result.sprint, remediationId: result.remediationId, attempt: serializeAttempt(result.attempt) });
  } catch (error) { next(error); }
}
