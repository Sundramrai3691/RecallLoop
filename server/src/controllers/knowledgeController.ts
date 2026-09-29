import type { NextFunction, Request, Response } from "express";
import { getConcept, getConceptResources, getRole, getSkill, listRoles } from "../services/knowledge/knowledgeService.js";

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
