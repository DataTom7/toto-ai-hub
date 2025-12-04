# Prompt-to-KB Migration Plan

## Executive Summary

This migration moves ~40-50% of hardcoded prompt content to the Knowledge Base (Firestore), enabling updates without deployment. It also implements the unused modular prompt system (PromptBuilder).

**Benefits:**
- ✅ Update conversation flows without waiting for builds
- ✅ A/B test different response templates
- ✅ Non-developers can update content
- ✅ More efficient RAG retrieval (only relevant KB entries)
- ✅ Consistent content across all agents

---

## Phase 1: Add New KB Entries ✅ READY

**Script:** `src/scripts/migrate-prompts-to-kb.ts`

**Run command:** `npm run migrate-prompts-to-kb`

**When to run:** After deployment to staging (where Firebase credentials are available)

**New KB entries (17 total):**

### Conversation Flows (7 entries) - HIGH PRIORITY
1. `kb-flow-donation-intent` - How to respond when user shows donation intent
2. `kb-flow-donation-amount-selected` - Response when user selects amount
3. `kb-flow-donation-verification` - Explanation of verification and totitos
4. `kb-flow-sharing-intent` - How to explain social media sharing
5. `kb-flow-help-seeking` - Response to "how can I help?"
6. `kb-flow-affirmative-response` - Handling "si/yes/ok" responses
7. `kb-flow-adoption-foster-inquiry` - Handling adoption/foster care questions

### Business Rules (2 entries) - MEDIUM PRIORITY
8. `kb-rules-donation-amounts` - Guidance on donation amounts
9. `kb-rules-minimum-donation` - No minimum donation policy

### Product Features (3 entries) - MEDIUM PRIORITY
10. `kb-feature-trf-definition` - TRF (Toto Rescue Fund) definition
11. `kb-feature-totitos-system` - Totitos rewards system explanation
12. `kb-feature-donation-verification` - Verification process details

### Conversation Guidelines (3 entries)
13. `kb-guide-first-message` - Guidelines for first conversation message
14. `kb-guide-conversation-progression` - How to advance conversations
15. Additional KB entries included in migration script

---

## Phase 2: Refactor CaseAgent to Use PromptBuilder 🔄 IN PROGRESS

**File to modify:** `src/agents/CaseAgent.ts`

### Current State (BEFORE):
```typescript
// CaseAgent.ts:183-398
protected getSystemPrompt(knowledgeContext?: string): string {
    const basePrompt = `You are Toto...` // 1,500+ lines hardcoded
    return basePrompt;
}
```

### Target State (AFTER):
```typescript
protected getSystemPrompt(knowledgeContext?: string): string {
    return PromptBuilder.create({ enableCache: true })
        .addComponent('persona', caseAgentPersona, 10)
        .addComponent('antiHallucination', antiHallucinationRules, 20)
        .addComponent('communicationStyle', communicationStyleForCaseAgent, 30)
        .addComponent('safetyEthics', safetyAndEthics, 40)
        .addIf(!!knowledgeContext, 'knowledge', knowledgeContext!, 50)
        .build().prompt;
}
```

**Benefits:**
- Automatic caching for performance
- Modular composition
- Easier to maintain
- Reusable across agents

---

## Phase 3: Remove Hardcoded Content ⏳ PENDING

Once KB entries are added and PromptBuilder is implemented:

### Content to REMOVE from CaseAgent.ts:

**Lines 223-310: Conversation Flow Instructions**
- Donation intent response (→ KB: `kb-flow-donation-intent`)
- Amount selection response (→ KB: `kb-flow-donation-amount-selected`)
- Sharing process explanation (→ KB: `kb-flow-sharing-intent`)
- Help-seeking response (→ KB: `kb-flow-help-seeking`)
- Affirmative response handling (→ KB: `kb-flow-affirmative-response`)

**Lines 211-256: Product Features**
- TRF definition (→ KB: `kb-feature-trf-definition`)
- Totitos system (→ KB: `kb-feature-totitos-system`)
- Minimum donation policy (→ KB: `kb-rules-minimum-donation`)

**Lines 258-267: Business Rules**
- Donation amount guidance (→ KB: `kb-rules-donation-amounts`)

**Estimated reduction:** ~600-750 lines → ~35-40% smaller prompt

---

## Phase 4: Testing ⏳ PENDING

### Test Checklist:

**1. KB Retrieval Testing**
- [ ] RAG service retrieves relevant KB entries for donation questions
- [ ] RAG service retrieves relevant KB entries for sharing questions
- [ ] RAG service retrieves relevant KB entries for help-seeking questions
- [ ] Verify audience filtering works (donors vs guardians)

**2. Response Quality Testing**
- [ ] Donation flow: "quiero donar" → correct response
- [ ] Amount question: "qué montos puedo donar?" → correct guidance
- [ ] Sharing: "cómo comparto?" → correct explanation
- [ ] Help-seeking: "cómo puedo ayudar?" → actionable steps (not case description)
- [ ] Affirmative: "si" after question → progresses conversation (no repeat)
- [ ] Adoption inquiry: handles missing info gracefully

**3. Performance Testing**
- [ ] Prompt caching working (check PromptBuilder.getCacheStats())
- [ ] Response times similar or better than before
- [ ] KB query times acceptable

**4. Edge Cases**
- [ ] Missing banking alias → offers TRF correctly
- [ ] No adoption info → suggests contacting guardian
- [ ] Multiple languages (Spanish/English)
- [ ] Quick action buttons appear correctly

---

## Phase 5: Deployment ⏳ PENDING

### Deployment Steps:

1. **Build:**
   ```bash
   cd toto-ai-hub
   npm run build
   ```

2. **Deploy to staging:**
   ```bash
   firebase deploy --only hosting:toto-ai-hub
   ```

3. **Run migration (in staging environment):**
   ```bash
   # SSH/Cloud Shell into staging environment
   npm run migrate-prompts-to-kb
   ```

4. **Verify KB entries:**
   - Check Firestore (toto-bo project) → `knowledge_base` collection
   - Should see 17 new entries with IDs starting with `kb-flow-`, `kb-rules-`, `kb-feature-`

5. **Sync to Vertex AI Search:**
   ```bash
   npm run sync-kb-to-vertex
   ```

6. **Test in staging:**
   - Use toto-app staging to test conversations
   - Verify responses match expected behavior
   - Check logs for any errors

7. **Deploy to production:**
   ```bash
   firebase deploy --only hosting:toto-ai-hub --project production
   ```

---

## Rollback Plan

If issues occur:

1. **Immediate:** Revert to previous deployment
   ```bash
   firebase hosting:rollback toto-ai-hub
   ```

2. **KB Entries:** Delete new entries if needed
   - Query: `knowledge_base` collection where `id` starts with `kb-flow-`, `kb-rules-`, `kb-feature-`
   - Can delete via Firebase Console or script

3. **Code:** Revert commits
   ```bash
   git revert <commit-hash>
   git push
   firebase deploy
   ```

---

## Monitoring

**After deployment, monitor:**

1. **Error Logs:**
   - Check Cloud Run logs for errors
   - Filter: "KnowledgeBaseService" or "RAGService"

2. **Response Quality:**
   - Monitor user satisfaction (if tracked)
   - Check for conversation failures
   - Verify quick actions appear correctly

3. **Performance:**
   - Response times (should be similar or better)
   - Cache hit rate (check PromptBuilder stats)
   - RAG retrieval times

4. **KB Usage:**
   - Check `usageCount` field in KB entries
   - Identify which entries are retrieved most
   - Optimize based on usage patterns

---

## Success Metrics

**Migration is successful when:**
- ✅ All 17 KB entries added to Firestore
- ✅ CaseAgent uses PromptBuilder
- ✅ Prompt size reduced by ~35-40%
- ✅ Response quality unchanged or improved
- ✅ No increase in error rate
- ✅ Content can be updated without deployment

---

## Next Improvements (Post-Migration)

1. **KB Management Dashboard:**
   - UI for editing KB entries
   - Version history for entries
   - A/B testing framework

2. **Analytics:**
   - Track which KB entries are most useful
   - Measure impact of content changes
   - User feedback on responses

3. **Expand to Other Agents:**
   - TwitterAgent: Move monitoring patterns to KB
   - InstagramAgent: Move analysis guidelines to KB
   - Create shared KB entries for all agents

4. **Content Optimization:**
   - Review KB usage analytics
   - Consolidate similar entries
   - Add missing conversation flows

---

## Timeline

- **Phase 1 (KB Entries):** ✅ COMPLETE - Script ready
- **Phase 2 (PromptBuilder):** 🔄 IN PROGRESS - ~2 hours
- **Phase 3 (Remove Hardcoded):** ⏳ PENDING - ~1 hour
- **Phase 4 (Testing):** ⏳ PENDING - ~2-3 hours
- **Phase 5 (Deployment):** ⏳ PENDING - ~1 hour

**Total estimated time:** ~6-7 hours

---

## Questions & Answers

**Q: Will this break existing conversations?**
A: No. The system will still respond correctly, just retrieving content from KB instead of hardcoded prompts.

**Q: What if RAG doesn't retrieve the right KB entry?**
A: The system falls back gracefully. Plus, we can improve retrieval by:
- Adjusting KB entry titles/content for better semantic matching
- Adding more specific keywords
- Tuning RAG parameters

**Q: Can we test KB changes without deployment?**
A: Yes! Update KB entries in Firestore, and changes take effect immediately (no deployment needed). That's the whole point!

**Q: What if we want to revert a KB content change?**
A: KB entries have `lastUpdated` timestamps. We can add versioning later, or for now, keep track of changes manually.

**Q: How do we know which KB entries are being used?**
A: Each entry has a `usageCount` field that increments when retrieved by RAG. We can analyze this to optimize content.

---

## Contact

For questions or issues:
- Check logs: Cloud Run → toto-ai-hub → Logs
- Review KB entries: Firestore Console → toto-bo → knowledge_base
- Test RAG: Use `/api/kb` endpoints to query knowledge base

---

**Status:** 🟡 Phase 1 Complete | Phase 2 In Progress
**Last Updated:** 2025-12-03
**Next Step:** Refactor CaseAgent to use PromptBuilder
