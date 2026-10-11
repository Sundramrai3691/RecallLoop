import type { NextFunction, Request, Response } from "express";
import { getConcept, getConceptResources, getRole, getRoleRoadmap, getSkill, listRoadmaps, listRoles } from "../services/knowledge/knowledgeService.js";
import type { AuthenticatedRequest } from "../lib/auth.js";

export async function listRolesHandler(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ roles: await listRoles() }); } catch (error) { next(error); }
}

export async function getRoleHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ role: await getRole(req.params.id) }); } catch (error) { next(error); }
}

export async function getSkillHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ skill: await getSkill(req.params.id) }); } catch (error) { next(error); }
}

export async function getConceptHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ concept: await getConcept(req.params.id) }); } catch (error) { next(error); }
}

export async function getConceptResourcesHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ resources: await getConceptResources(req.params.id) }); } catch (error) { next(error); }
}

export async function listRoadmapsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ roles: await listRoadmaps(req.user!.id) }); } catch (error) { next(error); }
}

export async function getRoleRoadmapHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const role = await getRoleRoadmap(req.params.id,req.user!.id);
    if (!role) { res.status(404).json({ error: "Knowledge role not found", code: "ROLE_NOT_FOUND" }); return; }
    res.json({ role });
  } catch (error) { next(error); }
}
