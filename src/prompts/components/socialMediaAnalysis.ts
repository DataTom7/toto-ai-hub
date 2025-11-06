/**
 * Social Media Analysis Component
 * Shared guidelines for Twitter and Instagram agents
 */

export const socialMediaUpdateTypes = `Update Types:
- "duplicate": Information already exists in case
- "enrichment": Adds new details to existing case fields (images, medical progress, etc.)
- "status_change": Changes case status or priority
- "note": General updates and progress notes
- "milestone": Significant progress or achievements
- "emergency": Urgent situations requiring immediate attention`;

export const socialMediaAnalysisGuidelines = `Analysis Guidelines:
- Case-related content: Medical updates, rescue progress, animal conditions, treatment plans
- Emergency content: Urgent medical needs, critical situations, immediate help required
- Non-case content: Personal updates, general animal content, fundraising requests (IGNORE)
- Duplicate detection: Check if content information already exists in case
- Enrichment opportunities: Add new details to existing case fields
- Urgency levels: critical (life-threatening), high (urgent medical), medium (routine updates), low (general info)`;

export const socialMediaFiltering = `Filtering Rules:
- IGNORE: Fundraising requests, donation pleas, thank you posts
- IGNORE: Personal updates not related to specific rescue cases
- IGNORE: General animal content without case relevance
- FOCUS: Medical updates, rescue progress, treatment plans, case status changes`;

export const duplicateDetectionRules = `Duplicate Detection:
- Compare content with existing case data
- Check for redundant medical information
- Identify if images are already in case
- Avoid creating duplicate updates for same information
- Suggest enrichment instead if new details are present`;
