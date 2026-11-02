import { providerConfiguration, validateRuntimeConfiguration } from "../config/env.js";

const config = providerConfiguration();
const productionCheck = process.argv.includes("--production");
const validation = validateRuntimeConfiguration(productionCheck ? { ...process.env, NODE_ENV: "production" } : process.env);
console.log("RecallLoop configuration preflight (credential values are never displayed)");
console.log(`Runtime mode: ${productionCheck ? "production preflight" : validation.mode}`);
for (const error of validation.errors) console.error(`ERROR: ${error}`);
for (const warning of validation.warnings) console.warn(`WARNING: ${warning}`);
console.log(`Runtime configuration: ${validation.errors.length ? "invalid" : "valid for selected mode"}`);
console.log(`LLM extraction and free-form evaluation: ${config.llm}${config.llmModel ? ` (${config.llmModel})` : ""}`);
console.log("Question generation: built-in deterministic blueprints and curated MCQs (not LLM-generated)");
console.log(`Embeddings: ${config.embeddings}${config.embeddingModel ? ` (${config.embeddingModel})` : ""}`);
console.log(`Grounded remediation: ${config.remediation}`);
for (const warning of config.warnings) console.warn(`WARNING: ${warning}`);
if (validation.errors.length) process.exitCode = 1;
