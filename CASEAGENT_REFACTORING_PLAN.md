# CaseAgent Refactoring Plan

**Date:** 2025-12-03
**Objective:** Replace 215 lines of hardcoded prompts with KB-driven, modular approach

---

## Current State Analysis

### Hardcoded Prompt Breakdown (lines 183-398):

**Total Lines:** 215 lines of hardcoded system prompt

**Content Categories:**
1. **Critical Rules (Keep):** ~40 lines
   - Case data validation
   - Never invent information
   - Safety and ethics

2. **Conversation Flows (Remove → KB):** ~80 lines
   - Donation intent handling
   - Amount selection flow
   - Sharing process
   - Help-seeking intent
   - Affirmative responses

3. **Business Rules (Remove → KB):** ~30 lines
   - No minimum donation
   - Donation amounts
   - TRF definition
   - Totitos system

4. **Product Features (Remove → KB):** ~25 lines
   - Donation process
   - Verification process
   - Social media sharing

5. **Communication Guidelines (Remove → KB):** ~40 lines
   - First message structure
   - Conversation progression
   - Tone and style
   - Language adaptation

**Redundancy:** All removed content (175 lines) is now available as KB entries!

---

## Refactoring Strategy

### Phase 1: Slim Down System Prompt
**Goal:** Reduce getSystemPrompt from 215 to ~60 lines

**Keep:**
- Core identity ("You are Toto...")
- Critical safety rules (never invent data, case validation)
- Language instruction (NEW: respond in user's language)
- KB integration point (knowledgeContext parameter)

**Remove (now in KB):**
- All conversation flow instructions
- All business rules details
- All product feature explanations
- Detailed communication guidelines

### Phase 2: Enhance KB Retrieval
**Current:** KB is retrieved and appended at end
**Improved:** Make KB retrieval more prominent and structured

**Changes:**
```typescript
// BEFORE
if (knowledgeContext) {
  return `${basePrompt}\n\n📚 RELEVANT KNOWLEDGE BASE INFORMATION:\n${knowledgeContext}...`;
}

// AFTER
const sections = [
  coreIdentity,
  languageInstruction,  // NEW
  knowledgeContext ? `📚 KNOWLEDGE BASE GUIDELINES:\n${knowledgeContext}` : '',
  criticalSafety
].filter(Boolean).join('\n\n');
```

### Phase 3: Optional PromptBuilder Integration
**Benefits:**
- Modular prompt components
- Caching for performance
- A/B testing capability
- Token usage tracking

**Implementation:**
```typescript
private getSystemPrompt(knowledgeContext?: string): string {
  const builder = PromptBuilder.create({ enableCache: true });

  return builder
    .addComponent('identity', CORE_IDENTITY, 1)
    .addComponent('language', LANGUAGE_INSTRUCTION, 2)
    .addIf(!!knowledgeContext, 'knowledge', knowledgeContext || '', 3)
    .addComponent('safety', CRITICAL_SAFETY, 4)
    .build().prompt;
}
```

---

## New System Prompt Structure

### Core Identity (15 lines)
```
You are Toto, an advanced AI assistant specialized in pet rescue cases.

🚨 CRITICAL: USE ONLY PROVIDED CASE DATA
- You receive case information in the "Case Information" section
- ONLY use exact details provided: name, description, status, etc.
- NEVER make up or assume case details not provided
- If information is missing, acknowledge it and suggest contacting guardian
- If banking alias is missing, immediately offer TRF alternative

[Rest of critical case validation rules]
```

### Language Instruction (5 lines - NEW)
```
🌍 LANGUAGE ADAPTATION:
- Respond in the user's language (detect from their message)
- Adapt tone and cultural references appropriately
- Use Spanish cultural notes when responding in Spanish
- Maintain natural, conversational language
```

### Knowledge Base Integration (dynamic)
```
📚 KNOWLEDGE BASE GUIDELINES:
[Retrieved KB entries about donation flows, business rules, etc.]

Use this knowledge to guide your responses about:
- Donation processes and amounts
- Product features (TRF, Totitos, verification)
- Conversation flows and best practices
```

### Critical Safety Rules (15 lines)
```
🔒 SAFETY & ETHICS:
- NEVER provide medical diagnosis or treatment advice
- No guarantees about adoption timelines or outcomes
- Respect user privacy and maintain confidentiality
- Be honest about donation usage and platform policies
- Never include sensitive data (banking aliases, URLs, social media handles) in text
```

**Total:** ~60 lines (vs. 215 before) = **73% reduction**

---

## KB Retrieval Enhancement

### Current Flow:
1. User sends message
2. RAG retrieves relevant KB entries
3. KB content appended to system prompt
4. LLM generates response

### Improvements:
1. **Better KB Querying:**
   ```typescript
   // Enhance query with intent detection
   const query = `${message} intent:${detectedIntent} category:conversation_flows`;
   const kbResults = await this.ragService.search(query, { limit: 5 });
   ```

2. **Structured KB Context:**
   ```typescript
   const knowledgeContext = kbResults.map(kb => `
   **${kb.title}**
   ${kb.content}
   ${kb.metadata?.culturalNotes ? `Cultural Notes: ${JSON.stringify(kb.metadata.culturalNotes)}` : ''}
   `).join('\n\n---\n\n');
   ```

3. **Category-Specific Retrieval:**
   - Donation intent → Retrieve conversation_flows + business_rules KB
   - Sharing intent → Retrieve conversation_flows + product_features KB
   - Help seeking → Retrieve conversation_guidelines KB

---

## Implementation Steps

### Step 1: Create New System Prompt Components
```typescript
// src/prompts/caseAgentPrompts.ts
export const CORE_IDENTITY = `You are Toto, an advanced AI assistant...`;
export const LANGUAGE_INSTRUCTION = `🌍 LANGUAGE ADAPTATION...`;
export const CRITICAL_SAFETY = `🔒 SAFETY & ETHICS...`;
```

### Step 2: Refactor getSystemPrompt Method
```typescript
protected getSystemPrompt(knowledgeContext?: string): string {
  const sections = [
    CORE_IDENTITY,
    LANGUAGE_INSTRUCTION,
    knowledgeContext ? `📚 KNOWLEDGE BASE GUIDELINES:\n${knowledgeContext}\n\nApply these guidelines to your responses.` : '',
    CRITICAL_SAFETY
  ].filter(Boolean);

  return sections.join('\n\n');
}
```

### Step 3: Optional PromptBuilder Version
```typescript
import { PromptBuilder } from '../prompts/PromptBuilder';

protected getSystemPromptWithBuilder(knowledgeContext?: string): string {
  const { prompt, metrics } = PromptBuilder.create({ enableCache: true })
    .addComponent('identity', CORE_IDENTITY, 1)
    .addComponent('language', LANGUAGE_INSTRUCTION, 2)
    .addIf(!!knowledgeContext, 'knowledge',
      `📚 KNOWLEDGE BASE GUIDELINES:\n${knowledgeContext}`, 3)
    .addComponent('safety', CRITICAL_SAFETY, 4)
    .build();

  // Log metrics for monitoring
  console.log('Prompt metrics:', metrics);

  return prompt;
}
```

### Step 4: Build and Test
```bash
cd toto-ai-hub
npm run build
```

### Step 5: Verify Compilation
- Check for TypeScript errors
- Verify imports
- Test prompt generation

---

## Expected Benefits

### Code Quality:
- ✅ 73% reduction in hardcoded content (215 → 60 lines)
- ✅ Better separation of concerns
- ✅ Easier maintenance and updates
- ✅ More testable code

### Performance:
- ✅ Smaller base prompt = faster processing
- ✅ Optional caching with PromptBuilder
- ✅ Reduced token usage

### Flexibility:
- ✅ Update KB without code changes
- ✅ Easy to add new languages
- ✅ A/B testing capability
- ✅ Content versioning

### Internationalization:
- ✅ English-only source of truth
- ✅ AI handles runtime translation
- ✅ Cultural notes preserved
- ✅ Ready for Portuguese, etc.

---

## Rollback Plan

If issues arise:
1. Git revert to previous commit
2. Backup available: Check git history
3. Original getSystemPrompt method preserved in git

---

## Testing Strategy

### Unit Tests:
- Test new getSystemPrompt with/without KB context
- Verify prompt component ordering
- Test PromptBuilder caching

### Integration Tests:
- Test with Spanish queries
- Test with English queries
- Test KB retrieval integration
- Verify cultural notes usage

### User Acceptance:
- Deploy to staging
- Test with real cases
- Monitor response quality
- Collect feedback

---

## Success Metrics

- [ ] Prompt size reduced by >70%
- [ ] All tests passing
- [ ] Spanish responses maintain quality
- [ ] English responses work correctly
- [ ] KB retrieval functioning
- [ ] No regression in user experience

---

**Status:** Ready for implementation
**Next:** Begin Step 1 - Create prompt components file
