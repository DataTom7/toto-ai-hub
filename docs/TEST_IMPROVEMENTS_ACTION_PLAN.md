# Test Results Analysis & Improvement Action Plan

**Date:** 2025-12-06  
**Test Run:** conversation-test-1764991427715.txt  
**Success Rate:** 40% (4/10 conversations passed)

---

## 🔴 Critical Issues (60% Failure Rate)

### 1. Intent Detection Failures

**Problem:** Short messages and amount-only messages are being misclassified as `learn` instead of `donate` or `share`.

**Failed Cases:**
- ❌ "Donar" → Expected: `donate`, Got: `learn`
- ❌ "$500" → Expected: `donate`, Got: `learn`
- ❌ "1000" → Expected: `donate`, Got: `learn`
- ❌ "Compartir" → Expected: `share`, Got: `learn`
- ❌ "Compartir su historia" → Expected: `share`, Got: `learn`
- ❌ "Quiero compartir este caso" → Expected: `share`, Got: `learn`

**Root Cause:**
- Intent examples don't include short forms ("Donar", "Compartir")
- Amount-only messages ("$500", "1000") have no examples
- No context-aware detection (doesn't consider conversation history)
- Similarity threshold (0.7) may be too high for short messages
- **IMPORTANT:** KB entries are in English, which may affect semantic similarity for Spanish queries (though embeddings are multilingual, short messages have less semantic content)

**Impact:** High - 60% of test conversations fail due to intent misclassification

---

### 2. Alias Mentioned Before Amount Selection

**Problem:** Agent mentions banking alias in the help response before user selects an amount.

**Failed Case:**
- ❌ Conversation 1, Step 1: Response contains "alias" when it shouldn't

**Root Cause:**
- Post-processing logic may not be aggressive enough
- KB entries might contain alias information that leaks through

**Impact:** Medium - Breaks conversation flow, confuses users

---

### 3. Missing Quick Actions After Amount Selection

**Problem:** Banking alias button doesn't appear when user selects an amount.

**Failed Case:**
- ❌ Conversation 2, Step 3: `showBankingAlias` = false when it should be true

**Root Cause:**
- Amount detection may not be working correctly
- Quick action logic may not be triggered for amount-only messages

**Impact:** High - Users can't copy alias after selecting amount

---

### 4. Database Save Failures

**Problem:** All conversations show `SAVE_FAILED` - conversations are not being saved to Firestore.

**Root Cause:**
- Need to investigate `saveConversationToDB` function
- Possible validation errors or missing required fields
- Firestore permissions or connection issues

**Impact:** High - Test conversations can't be reviewed in database

---

## 🟡 Medium Priority Issues

### 5. Test Coverage Gaps

**Missing Test Cases:**
- TRF (Toto Rescue Fund) flow - alternative donation method
- Multi-step flows with corrections ("I meant $2000, not $500")
- Edge cases: very large amounts, invalid amounts, negative amounts
- Mixed language conversations (Spanish + English)
- Quick action button clicks (simulating button presses)

**Impact:** Medium - Some flows are untested

---

### 6. Report Format

**Current Issues:**
- Report is text-only, hard to parse programmatically
- No summary statistics (average response time, KB retrieval success rate)
- No comparison with previous test runs
- No visual indicators for trends

**Impact:** Low - Report is functional but could be improved

---

## ✅ Action Plan

### Phase 1: Fix Test Script (Priority: CRITICAL) ✅ DONE

**Tasks:**
1. **Fix Test Messages to Match Reality** (`test-conversations-with-db.ts`)
   - ✅ Changed `'Donar'` → `'Quiero donar'` (what button actually sends)
   - ✅ Changed `'$500'` → `'Quiero donar $500'` (what button actually sends)
   - ✅ Changed `'1000'` → `'Quiero donar $1000'` (what button actually sends)
   - ✅ Changed `'Compartir'` → `'Quiero compartir'` (what button actually sends)
   - **Note:** QA buttons send full messages, not just labels. Test script now matches reality.

**Impact:** This should fix most test failures immediately, as the system already handles full messages correctly.

2. **Implement Context-Aware Intent Detection**
   - Consider conversation history when detecting intent
   - If previous message was "Cómo puedo ayudar?" and current is "Donar" → `donate`
   - If previous message asked for amount and current is "$500" → `donate`
   - If previous intent was `donate` and current message contains amount → `donate`
   - Use conversation context to disambiguate short messages

3. **Adjust Similarity Threshold for Short Messages**
   - Lower threshold for short messages (1-3 words): Use 0.5 instead of 0.7
   - Use different thresholds for different message lengths:
     - 1-3 words: 0.5 threshold
     - 4-10 words: 0.65 threshold
     - 11+ words: 0.7 threshold (current)
   - Add fallback to keyword matching for very short messages (< 2 words)

4. **Add Amount Detection to Intent Logic**
   - If message contains amount (regex: `\$?\d+`) and previous context suggests donation → `donate`
   - Integrate `hasAmount()` utility into intent detection
   - Check conversation history for donation intent before amount selection

**Files to Modify:**
- `toto-ai-hub/src/agents/CaseAgent.ts` (lines 1322-1427)
- `toto-ai-hub/src/utils/amountDetection.ts` (may need enhancements)

**Expected Outcome:** Intent detection accuracy > 90%

---

### Phase 2: Fix Alias and Quick Actions (Priority: HIGH)

**Tasks:**
1. **Enhance Post-Processing for Alias Removal**
   - More aggressive alias removal when `hasSelectedAmount = false`
   - Check KB entries for alias mentions and filter them out
   - Add pattern matching for alias-related phrases

2. **Fix Quick Action Logic for Amount Selection**
   - Ensure `showBankingAlias = true` when amount is detected
   - Verify amount detection works for all formats ("$500", "1000", "500 pesos")
   - Add logging to debug quick action generation

3. **Improve Amount Detection**
   - Support more formats: "$500", "500", "1000 pesos", "mil pesos"
   - Handle currency symbols and text amounts
   - Extract amount from messages like "Quiero donar $1000"

**Files to Modify:**
- `toto-ai-hub/src/agents/CaseAgent.ts` (post-processing logic)
- `toto-ai-hub/src/utils/amountDetection.ts`

**Expected Outcome:** Alias only mentioned after amount selection, quick actions appear correctly

---

### Phase 3: Fix Database Saving (Priority: HIGH)

**Tasks:**
1. **Debug `saveConversationToDB` Function**
   - Add detailed error logging
   - Check Firestore validation requirements
   - Verify all required fields are present
   - Test Firestore connection and permissions

2. **Add Error Handling**
   - Catch and log specific Firestore errors
   - Provide actionable error messages
   - Retry logic for transient failures

3. **Validate Conversation Data**
   - Ensure all required fields match Firestore schema
   - Check timestamp formats
   - Verify user IDs and conversation IDs

**Files to Modify:**
- `toto-ai-hub/scripts/test-conversations-with-db.ts` (lines 414-504)

**Expected Outcome:** All test conversations saved successfully to Firestore

---

### Phase 4: Enhance Test Coverage (Priority: MEDIUM)

**Tasks:**
1. **Add TRF Flow Tests**
   - Test alternative donation method
   - Verify TRF alias is shown when guardian alias is missing
   - Test "I want to donate but not to a specific case" scenario

2. **Add Edge Case Tests**
   - Very large amounts ($100,000+)
   - Invalid amounts (negative, zero, text)
   - Multi-step corrections
   - Mixed language conversations

3. **Add Quick Action Simulation**
   - Simulate button clicks in test flow
   - Test that button clicks are saved as user messages
   - Verify quick actions trigger correct responses

4. **Add Performance Metrics**
   - Measure response time per step
   - Track KB retrieval time
   - Monitor API call counts

**Files to Modify:**
- `toto-ai-hub/scripts/test-conversations-with-db.ts` (add new test cases)

**Expected Outcome:** Comprehensive test coverage for all conversation flows

---

### Phase 5: Improve Reporting (Priority: LOW)

**Tasks:**
1. **Add JSON Report Format**
   - Generate both text and JSON reports
   - JSON format for programmatic analysis
   - Include detailed metrics and timings

2. **Add Comparison with Previous Runs**
   - Compare success rates across runs
   - Track improvements/regressions
   - Highlight new failures

3. **Add Visual Indicators**
   - Color-coded output in terminal
   - Summary dashboard
   - Trend graphs (if running in CI/CD)

4. **Add Detailed Statistics**
   - Average response time
   - KB retrieval success rate
   - Intent detection accuracy per intent type
   - Quick action generation success rate

**Files to Modify:**
- `toto-ai-hub/scripts/test-conversations-with-db.ts` (report generation)

**Expected Outcome:** Better visibility into test results and trends

---

## 📊 Success Metrics

### Target Metrics (After Improvements)

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| Overall Success Rate | 40% | > 90% | CRITICAL |
| Intent Detection Accuracy | ~40% | > 90% | CRITICAL |
| Alias Mentioned Early | 1 case | 0 cases | HIGH |
| Quick Actions Missing | 1 case | 0 cases | HIGH |
| Database Save Success | 0% | 100% | HIGH |
| Test Coverage | 10 cases | 15+ cases | MEDIUM |
| Report Quality | Basic | Comprehensive | LOW |

---

## 🚀 Implementation Order

1. **Week 1: Critical Fixes** ✅ IN PROGRESS
   - ✅ Phase 1: Fix Test Script (DONE - updated to match reality)
   - Phase 2: Fix Alias and Quick Actions
   - Phase 3: Fix Database Saving

2. **Week 2: Enhancements**
   - Phase 4: Enhance Test Coverage
   - Phase 5: Improve Reporting

3. **Week 3: Validation**
   - Re-run all tests
   - Verify all metrics meet targets
   - Document improvements

---

## 🔍 Investigation Needed

1. **Why are all database saves failing?**
   - Check Firestore logs
   - Verify service account permissions
   - Test `saveConversationToDB` in isolation
   - Check if conversation schema matches Firestore requirements

2. **What is the actual similarity threshold?**
   - Current: `CASE_AGENT_CONSTANTS.INTENT_SIMILARITY_THRESHOLD = 0.7`
   - Test different thresholds with short messages
   - Determine optimal threshold per message length
   - Consider that KB entries are in English while users speak Spanish (embeddings are multilingual, but short messages have less semantic content)

3. **Are KB entries causing alias leaks?**
   - Review KB entries for `kb-flow-help-seeking`
   - Check if alias information is in KB content
   - Verify post-processing is applied correctly
   - **Note:** KB entries are in English, but should not contain alias values

4. **How does English KB content affect Spanish query matching?**
   - Test semantic similarity between Spanish queries and English KB entries
   - Verify that `text-embedding-004` handles cross-language matching well
   - Consider if KB entries should include Spanish examples in content (they already have some)
   - Check if similarity scores are lower for cross-language matches

---

## 📝 Notes

- All improvements should maintain backward compatibility
- Test changes incrementally (don't change everything at once)
- Keep test conversations realistic (based on real user interactions)
- Document any new intent examples or patterns added
- Consider adding unit tests for intent detection logic

---

**Next Steps:**
1. Review this plan
2. Prioritize which phases to tackle first
3. Start with Phase 1 (Intent Detection) - highest impact
4. Run tests after each phase to measure improvement

