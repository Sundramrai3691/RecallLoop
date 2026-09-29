import { Router } from "express";
import {
  getConceptHandler,
  getConceptResourcesHandler,
  getRoleHandler,
  getSkillHandler,
  listRolesHandler,
} from "../controllers/knowledgeController.js";

export const knowledgeRouter = Router();

knowledgeRouter.get("/roles", listRolesHandler);
knowledgeRouter.get("/roles/:id", getRoleHandler);
knowledgeRouter.get("/skills/:id", getSkillHandler);
knowledgeRouter.get("/concepts/:id", getConceptHandler);
knowledgeRouter.get("/concepts/:id/resources", getConceptResourcesHandler);
