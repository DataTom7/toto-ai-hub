# Test Improvements - Quick Summary

## 🎯 Top 3 Critical Issues

### 1. Intent Detection (60% failure rate)
**Problem:** Short messages misclassified as `learn` instead of `donate`/`share`  
**Fix:** Add short forms and amount-only examples to `INTENT_EXAMPLES`  
**File:** `toto-ai-hub/src/agents/CaseAgent.ts` (line 1322)  
**Impact:** Will fix 6/10 failed conversations

### 2. Database Saving (100% failure rate)
**Problem:** All conversations show `SAVE_FAILED`  
**Fix:** Debug `saveConversationToDB` function, check Firestore validation  
**File:** `toto-ai-hub/scripts/test-conversations-with-db.ts` (line 414)  
**Impact:** Enables conversation review in database

### 3. Missing Quick Actions
**Problem:** Banking alias button doesn't appear after amount selection  
**Fix:** Improve amount detection and quick action logic  
**Files:** `CaseAgent.ts` (quick actions), `amountDetection.ts`  
**Impact:** Users can't copy alias after selecting amount

---

## 📋 Quick Action Items

### Immediate (This Week)
- [ ] Add short forms to intent examples: "Donar", "Compartir", "$500", "1000"
- [ ] Add context-aware intent detection (consider conversation history)
- [ ] Debug database save failures (check Firestore logs)
- [ ] Fix quick action generation for amount-only messages

### Short Term (Next Week)
- [ ] Add TRF flow tests
- [ ] Add edge case tests (large amounts, invalid amounts)
- [ ] Enhance post-processing to remove alias mentions earlier
- [ ] Improve amount detection (support more formats)

### Long Term (Next Month)
- [ ] Add JSON report format
- [ ] Add comparison with previous test runs
- [ ] Add performance metrics (response time, KB retrieval time)
- [ ] Add quick action button simulation

---

## 📊 Current vs Target Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Success Rate | 40% | > 90% |
| Intent Accuracy | ~40% | > 90% |
| DB Save Success | 0% | 100% |

---

## 🔧 Key Files to Modify

1. **`toto-ai-hub/src/agents/CaseAgent.ts`**
   - Line 1322: Expand `INTENT_EXAMPLES`
   - Line 1315: Add context-aware intent detection
   - Post-processing: Enhance alias removal

2. **`toto-ai-hub/src/utils/amountDetection.ts`**
   - Improve amount extraction
   - Support more formats

3. **`toto-ai-hub/scripts/test-conversations-with-db.ts`**
   - Line 414: Fix `saveConversationToDB`
   - Add more test cases
   - Improve report generation

---

## 💡 Quick Wins

1. **Add 5 intent examples** → Should fix 3-4 failed conversations
2. **Lower similarity threshold for short messages** → Should fix 2-3 failed conversations
3. **Fix database save error** → Enables conversation review
4. **Add amount detection to intent logic** → Should fix amount-only messages

---

**Full Details:** See `TEST_IMPROVEMENTS_ACTION_PLAN.md`

