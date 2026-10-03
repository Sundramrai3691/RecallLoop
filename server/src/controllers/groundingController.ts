import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { createGroundedRemediation, createVerification, getGroundedRemediation, getGroundingSources, getGroundingSource, ingestGroundingSource } from "../services/grounding/groundedRemediationService.js";
import { serializeAttempt } from "../lib/serialize.js";

export async function ingestSourceHandler(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const result=await ingestGroundingSource(req.user!.id,req.body??{});res.status(result.duplicate?200:201).json({source:result});}catch(error){next(error);}}
export async function listSourcesHandler(req:AuthenticatedRequest,res:Response,next:NextFunction){try{res.json({sources:await getGroundingSources(req.user!.id)});}catch(error){next(error);}}
export async function getSourceHandler(req:AuthenticatedRequest,res:Response,next:NextFunction){try{res.json({source:await getGroundingSource(req.user!.id,req.params.id)});}catch(error){next(error);}}
export async function createRemediationHandler(req:AuthenticatedRequest,res:Response,next:NextFunction){try{res.json({remediation:await createGroundedRemediation(req.user!.id,req.params.attemptId)});}catch(error){next(error);}}
export async function getRemediationHandler(req:AuthenticatedRequest,res:Response,next:NextFunction){try{res.json({remediation:await getGroundedRemediation(req.user!.id,req.params.id)});}catch(error){next(error);}}
export async function verifyRemediationHandler(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const result=await createVerification(req.user!.id,req.params.id);res.json({remediationId:result.remediationId,attempt:serializeAttempt(result.attempt)});}catch(error){next(error);}}
