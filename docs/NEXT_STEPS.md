# Next Steps - Flow Implementation Status

**Date:** January 2025  
**Status:** Infrastructure Complete, LLM Behavior Needs Tuning

---

## ✅ Completed

1. **Totitos Question Enforcement** - Post-processing ensures Totitos question is asked
2. **Enhanced KB Logging** - Tracks which KB entries are retrieved
3. **Comprehensive Test Script** - Tests 100% of both flows
4. **KB Entries in Firestore** - All 4 flow entries added and verified
5. **API Key Configuration** - dotenv properly configured
6. **Audience Filtering** - Handles "all" as wildcard
7. **Embeddings Generated** - All entries have embeddings cached

**Test Success Rate:** 54.2% (up from 27.1%)

---

## ⚠️ Remaining Issues

### Issue 1: Intent Detection Failing
**Problem:** "Quiero donar" returns "general" instead of "donate"  
**Root Cause:** Intent detection uses English keywords, but translation to English is failing (403 error)  
**Impact:** Quick actions not shown, wrong KB entries retrieved

**Solution Options:**
1. **Add Spanish keywords as fallback** (Quick fix)
   - Add Spanish keywords directly to intent detection
   - Don't rely solely on translation

2. **Improve translation fallback** (Better fix)
   - Add hardcoded Spanish→English mapping for common phrases
   - Use translation only as enhancement, not requirement

3. **Use semantic matching** (Best fix)
   - Use embeddings for intent detection instead of keyword matching
   - More robust across languages

**Recommendation:** Option 1 (quick fix) + Option 2 (improvement)

---

### Issue 2: KB Entries Not Always Retrieved
**Problem:** Flow KB entries exist but aren't always retrieved by RAG  
**Root Cause:** Semantic similarity might be low, or entries need better content structure  
**Impact:** LLM doesn't follow flow guidelines

**Solution Options:**
1. **Improve KB entry content** - Add more keywords/phrases that match user queries
2. **Lower similarity threshold** - Currently 0.0 (accepts all), but might need tuning
3. **Boost flow entries** - Give flow entries higher priority in search

**Recommendation:** Option 1 - Improve KB entry content with more query-matching phrases

---

### Issue 3: LLM Not Following KB Instructions
**Problem:** LLM sometimes ignores KB guidelines (e.g., doesn't ask for amount)  
**Root Cause:** KB instructions might not be strong enough, or LLM needs better prompting  
**Impact:** Wrong responses, missing quick actions

**Solution Options:**
1. **Strengthen KB entries** - Make instructions more explicit and mandatory
2. **Improve post-processing** - More aggressive filtering/enforcement
3. **Better prompts** - Enhance system prompts to emphasize KB compliance

**Recommendation:** Option 1 + Option 2 - Strengthen KB entries and improve post-processing

---

## 🎯 Recommended Next Steps (Priority Order)

### Priority 1: Fix Intent Detection (Critical)
**Why:** Without correct intent detection, everything else fails  
**Action:** Add Spanish keywords to intent detection as fallback

```typescript
// In CaseAgent.ts analyzeUserIntent()
const intents = {
  donate: [
    // English
    'donate', 'donation', 'help financially', 'give money', 'contribute', 'payment',
    // Spanish (fallback)
    'donar', 'donación', 'quiero donar', 'me gustaría donar'
  ],
  share: [
    // English
    'share', 'tell others', 'spread the word', 'post', 'social media',
    // Spanish (fallback)
    'compartir', 'quiero compartir', 'comparto', 'redes sociales'
  ],
  // ... etc
};
```

**Estimated Time:** 30 minutes  
**Impact:** High - Fixes intent detection immediately

---

### Priority 2: Improve KB Entry Content
**Why:** Better content = better semantic matching = correct entries retrieved  
**Action:** Update flow KB entries with more query-matching phrases

**Example for `kb-flow-donation-intent`:**
- Add to content: "User queries that match this: 'quiero donar', 'donate', 'I want to donate', 'me gustaría donar', 'how do I donate', 'cómo dono'"
- This helps embeddings match better

**Estimated Time:** 1 hour  
**Impact:** Medium-High - Improves KB retrieval

---

### Priority 3: Strengthen Post-Processing
**Why:** Ensures LLM output follows rules even if KB isn't retrieved  
**Action:** Enhance `postProcessResponse` to be more aggressive

**Example:**
- If intent is "donate" and response doesn't ask for amount → Force add amount question
- If intent is "help" and response repeats case info → Remove it

**Estimated Time:** 1-2 hours  
**Impact:** Medium - Provides safety net

---

### Priority 4: Test in Real App
**Why:** Test script is synthetic - need to verify real user experience  
**Action:** 
1. Start server: `npm start`
2. Test flows manually in toto-app
3. Monitor logs for KB retrieval and intent detection

**Estimated Time:** 30 minutes  
**Impact:** High - Validates everything works end-to-end

---

## 📊 Current Test Results

```
Total Tests: 48
✅ Passed: 26 (54.2%)
❌ Failed: 22 (45.8%)

Key Failures:
- Intent detection: "Quiero donar" → "general" (should be "donate")
- Intent detection: "Quiero compartir" → "general" (should be "share")
- KB retrieval: Flow entries not always retrieved
- Response content: LLM not always following KB instructions
```

---

## 🚀 Quick Win: Fix Intent Detection

The fastest way to improve success rate is fixing intent detection. Here's what to do:

1. **Add Spanish keywords** to intent detection (30 min)
2. **Test again** - Should see immediate improvement
3. **Then tackle** KB content and post-processing

---

## 📝 Files to Modify

1. **`toto-ai-hub/src/agents/CaseAgent.ts`** (Line ~863)
   - Add Spanish keywords to intent detection

2. **`toto-ai-hub/kb-entries-to-review/conversation-flows/*.json`** (Optional)
   - Improve content with more query-matching phrases

3. **`toto-ai-hub/src/agents/CaseAgent.ts`** (Line ~1448)
   - Enhance post-processing for stricter enforcement

---

## ✅ Success Criteria

- [ ] Intent detection works for Spanish messages
- [ ] Test success rate > 80%
- [ ] Flow KB entries retrieved correctly
- [ ] Real app testing confirms flows work
- [ ] All quick actions appear at correct times

---

**Recommendation:** Start with Priority 1 (Intent Detection) - it's the quickest win and will have the biggest impact.

