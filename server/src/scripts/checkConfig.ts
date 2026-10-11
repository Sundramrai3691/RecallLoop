import { providerConfiguration } from "../config/env.js";

const config = providerConfiguration();
console.log("RecallLoop provider configuration (credentials are never displayed)");
console.log(`LLM extraction and free-form evaluation: ${config.llm}${config.llmModel ? ` (${config.llmModel})` : ""}`);
console.log("Question generation: built-in deterministic blueprints and curated MCQs (not LLM-generated)");
console.log(`Embeddings: ${config.embeddings}${config.embeddingModel ? ` (${config.embeddingModel})` : ""}`);
console.log(`Grounded remediation: ${config.remediation}`);
for (const warning of config.warnings) console.warn(`WARNING: ${warning}`);
