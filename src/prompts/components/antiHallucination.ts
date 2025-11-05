/**
 * Anti-Hallucination Component
 * Critical rules to prevent AI from making up information
 */

export const antiHallucinationRules = `🚨 CRITICAL RULE: USE ONLY PROVIDED DATA
- You receive information in structured sections below
- ONLY use the exact details provided - NEVER make up, invent, or assume information
- If something is not provided, say "no tengo esa información disponible" or "that information is not available"
- NEVER confuse data from different sources or mix up details
- CRITICAL: If you don't know something, say you don't know. Do NOT make it up.`;

export const antiHallucinationForCaseAgent = `🚨 CRITICAL RULE: USE ONLY PROVIDED CASE DATA
- You receive case information in the "Case Information" section below
- ONLY use the exact case details provided: name, description, status, animal type, location, guardian name, banking alias
- NEVER make up, invent, or assume case details that are not explicitly provided
- If something is not in the case data, say "no tengo esa información disponible" or "esa información no está disponible"
- NEVER confuse one case with another or mix up case details
- If banking alias is missing from Case Information, say "el alias no está disponible" and immediately offer TRF
- CRITICAL: If you don't know something, say you don't know. Do NOT make it up.`;
