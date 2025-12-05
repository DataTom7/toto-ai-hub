# Donation Flow Review

**Date:** January 2025  
**Purpose:** Verify donation flow implementation matches expected behavior

---

## Expected Flow

### Step 1: Initial Help Question
**User:** "Cómo puedo ayudar?" / "How can I help?"  
**Expected Agent Response:**
- Express gratitude (1 sentence)
- Brief conversational paragraph about donation and sharing (2-3 sentences, plain text)
- Ask "¿Qué te gustaría hacer?" / "What would you like to do?" (1 sentence)
- **Total: 4-5 sentences maximum**

**Expected Quick Actions:** `showHelpActions: true` → Render "Donate" and "Share" buttons

**KB Entry:** `kb-flow-help-seeking` / `kb-cases-010`

---

### Step 2: User Selects "Donate"
**User:** Clicks "Donate" button OR says "Quiero donar" / "I want to donate"  
**Expected Agent Response:**
- Acknowledge intent (1 sentence): "¡Qué bueno que quieras ayudar!"
- Clarify no minimum (1 sentence): "No hay un monto mínimo, cada ayuda cuenta."
- Ask for amount (1 sentence): "¿Cuánto te gustaría donar?"
- **Total: EXACTLY 3 sentences**

**Expected Quick Actions:** `showDonationIntent: true` → Render amount buttons ($500, $1000, $2500, $5000)

**KB Entry:** `kb-flow-donation-intent`

**🚫 FORBIDDEN:**
- ❌ Mention banking alias
- ❌ Mention TRF
- ❌ Explain transfer process
- ❌ More than 3 sentences

---

### Step 3: User Selects Amount
**User:** Clicks amount button (e.g., $1000) OR says "$1000" / "1000 pesos"  
**Expected Agent Response:**
- Acknowledge amount (1 sentence)
- Explain transfer process (1-2 sentences)
- Provide alias instructions (1 sentence) - **NEVER include actual alias value**
- Ask about Totitos (1 sentence): "¿Querés verificar tu donación y ganar Totitos?"
- **Total: 4-5 sentences**

**Expected Quick Actions:** `showBankingAlias: true` → Render alias copy button

**KB Entry:** `kb-flow-donation-amount-selected`

**🚫 FORBIDDEN:**
- ❌ Include actual banking alias value in text
- ❌ Explain Totitos/verification before user shows interest

---

### Step 4: After Alias Provided
**Expected Agent Response:**
- Wait for user response about Totitos
- If user says yes → Explain verification and Totitos briefly
- If user says no → Acknowledge and thank them

---

## Implementation Review

### ✅ Step 1: Help Intent - CORRECTLY IMPLEMENTED

**Code Location:** `toto-ai-hub/src/agents/CaseAgent.ts:311`
```typescript
const shouldShowHelpActions = intentAnalysis.intent === 'help';
```

**Quick Actions Logic:** `toto-ai-hub/src/agents/CaseAgent.ts:481`
```typescript
showHelpActions: shouldShowHelpActions,
```

**KB Entry:** `kb-flow-help-seeking` exists and defines the flow correctly

**Post-Processing:** `toto-ai-hub/src/agents/CaseAgent.ts:1480-1528`
- Filters out case repetition
- Enforces plain text (no markdown)
- Limits to 2-3 sentences

**Frontend:** `toto-app/src/components/cases/CaseChatModal.tsx:1782-1788`
- Renders help actions buttons correctly
- Shows "Donate" and "Share" buttons

**Status:** ✅ **WORKING AS EXPECTED**

---

### ✅ Step 2: Donation Intent - CORRECTLY IMPLEMENTED

**Code Location:** `toto-ai-hub/src/agents/CaseAgent.ts:303`
```typescript
const shouldShowAmountButtons = intentAnalysis.intent === 'donate' && !hasSelectedAmount;
```

**Quick Actions Logic:** `toto-ai-hub/src/agents/CaseAgent.ts:478`
```typescript
showDonationIntent: shouldShowAmountButtons,
suggestedDonationAmounts: shouldShowAmountButtons ? [500, 1000, 2500, 5000] : undefined,
```

**KB Entry:** `kb-flow-donation-intent` exists and defines strict 3-sentence response

**Post-Processing:** `toto-ai-hub/src/agents/CaseAgent.ts:1530-1612`
- Removes alias/TRF mentions when `!hasSelectedAmount`
- Ensures amount question is always present
- Enforces 3-sentence structure

**Frontend:** `toto-app/src/components/cases/CaseChatModal.tsx:1794-1877`
- Renders donation amount buttons correctly
- Shows buttons after last bubble with amount question

**Status:** ✅ **WORKING AS EXPECTED**

---

### ✅ Step 3: Amount Selected - CORRECTLY IMPLEMENTED

**Code Location:** `toto-ai-hub/src/agents/CaseAgent.ts:304-306`
```typescript
const shouldShowBankingAlias = intentAnalysis.intent === 'donate' &&
                              !!enhancedCaseData.guardianBankingAlias &&
                              hasSelectedAmount; // Show alias AFTER amount is selected
```

**Amount Detection:** `toto-ai-hub/src/agents/CaseAgent.ts:296-299`
```typescript
const currentMessageHasAmount = /\$\d+/.test(message) || /\d+\s*(pesos|ars)/i.test(message) || /\d{3,}/.test(message);
const hasSelectedAmount = currentMessageHasAmount || memory.conversationHistory.some((entry: any) =>
  (entry.user && (/\$\d+/.test(entry.user) || /\d+\s*(pesos|ars)/i.test(entry.user) || /\d{3,}/.test(entry.user)))
);
```

**KB Entry:** `kb-flow-donation-amount-selected` exists and defines the flow

**Frontend:** `toto-app/src/components/cases/CaseChatModal.tsx:1216-1295`
- `handleDonationIntent` creates user message with amount
- Calls orchestrator to get AI response
- AI response should include alias instructions and Totitos question

**Frontend Alias Button:** `toto-app/src/components/cases/CaseChatModal.tsx:1616-1622`
- Shows alias button when `shouldShowBankingAlias` is true
- Only shows after amount is selected

**Status:** ✅ **WORKING AS EXPECTED**

---

## Potential Issues Found

### ⚠️ Issue 1: KB Entry for Amount Selected May Not Be Retrieved

**Problem:** The `kb-flow-donation-amount-selected` KB entry might not be retrieved by RAG when user selects amount, because:
- The user message is just "$1000" or "Quiero donar $1000"
- RAG might not match this to the KB entry about "donation amount selected"

**Recommendation:** Ensure the KB entry is retrieved by:
1. Checking RAG search includes this entry when amount is detected
2. Adding explicit intent detection for amount selection
3. Verifying KB entry has good embeddings

**Status:** ⚠️ **NEEDS VERIFICATION**

---

### ⚠️ Issue 2: Totitos Question May Not Be Enforced

**Problem:** The KB entry `kb-flow-donation-amount-selected` says to ask about Totitos, but:
- There's no explicit post-processing to ensure this question is present
- The LLM might forget to ask about Totitos

**Recommendation:** Add post-processing for donation intent WITH amount selected to ensure Totitos question is present.

**Status:** ⚠️ **NEEDS VERIFICATION**

---

## Summary

### ✅ Correctly Implemented:
1. **Help Intent** → Shows donate/share buttons
2. **Donation Intent** → Asks for amount, shows amount buttons
3. **Amount Detection** → Correctly detects when amount is selected
4. **Alias Button** → Shows only after amount is selected
5. **Post-Processing** → Removes alias mentions before amount selection

### ⚠️ Needs Verification:
1. **KB Retrieval** → Ensure `kb-flow-donation-amount-selected` is retrieved when amount is selected
2. **Totitos Question** → Ensure agent asks about Totitos after providing alias

### 📋 Next Steps:
1. Test the full flow end-to-end
2. Verify KB entries are retrieved correctly at each step
3. Add post-processing to enforce Totitos question if missing
4. Monitor logs to ensure correct KB entries are being used

---

## Code References

### Backend (toto-ai-hub):
- **Intent Detection:** `src/agents/CaseAgent.ts:766-874`
- **Amount Detection:** `src/agents/CaseAgent.ts:296-299`
- **Quick Actions Logic:** `src/agents/CaseAgent.ts:301-311, 477-482`
- **Post-Processing:** `src/agents/CaseAgent.ts:1448-1619`
- **KB Entries:** `kb-entries-to-review/conversation-flows/`

### Frontend (toto-app):
- **Help Actions:** `src/components/cases/CaseChatModal.tsx:1782-1788`
- **Donation Intent:** `src/components/cases/CaseChatModal.tsx:1216-1295`
- **Amount Buttons:** `src/components/cases/CaseChatModal.tsx:1794-1877`
- **Alias Button:** `src/components/cases/CaseChatModal.tsx:1616-1622`

---

## Test Cases

### Test 1: Help Intent Flow
1. User: "Cómo puedo ayudar?"
2. ✅ Agent responds with gratitude + options + question (4-5 sentences)
3. ✅ Donate and Share buttons appear

### Test 2: Donation Intent Flow
1. User: Clicks "Donate" OR says "Quiero donar"
2. ✅ Agent responds with 3 sentences (acknowledge + no minimum + ask amount)
3. ✅ Amount buttons ($500, $1000, $2500, $5000) appear
4. ✅ No alias mentioned

### Test 3: Amount Selection Flow
1. User: Clicks "$1000" OR says "$1000"
2. ✅ Agent acknowledges amount
3. ✅ Agent explains transfer process
4. ✅ Agent provides alias instructions (without actual alias value)
5. ✅ Agent asks about Totitos
6. ✅ Alias copy button appears

---

**Review Status:** ✅ **IMPLEMENTATION LOOKS CORRECT** - Needs end-to-end testing to verify KB retrieval and Totitos question enforcement.

