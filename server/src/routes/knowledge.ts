import { Router } from "express";
import {
  getConceptHandler,
  getConceptResourcesHandler,
  getRoleHandler,
  getRoleRoadmapHandler,
  getSkillHandler,
  listRoadmapsHandler,
  listRolesHandler,
} from "../controllers/knowledgeController.js";
import { requireAuth } from "../lib/auth.js";

export const knowledgeRouter = Router();

knowledgeRouter.get("/roles", listRolesHandler);
knowledgeRouter.get("/roadmaps", requireAuth, listRoadmapsHandler);
knowledgeRouter.get("/roles/:id/roadmap", requireAuth, getRoleRoadmapHandler);
knowledgeRouter.get("/roles/:id", getRoleHandler);
knowledgeRouter.get("/skills/:id", getSkillHandler);
knowledgeRouter.get("/concepts/:id", getConceptHandler);
knowledgeRouter.get("/concepts/:id/resources", getConceptResourcesHandler);
