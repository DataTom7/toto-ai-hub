# Comprehensive Flow Analysis - Donation & Sharing

**Date:** January 2025  
**Status:** Analysis in Progress

---

## Expected Flows (User Requirements)

### 1. Initial Flow (After Welcome Message)

**Expected:**
- User: [Welcome message shown]
- Agent: "¿Qué te gustaría hacer?" / "What would you like to do?"
- UI: Show QA buttons (Donate, Share) - **ONCE, after relevant bubble**

**Current Implementation:**
- ✅ Help-seeking intent detected correctly
- ✅ `showHelpActions: true` set when intent is "help"
- ✅ Frontend renders Donate/Share buttons
- ❌ **ISSUE**: Buttons rendering multiple times (once per bubble)

---

### 2. Donation Flow

#### Step 1: User Clicks "Donate" Button

**Expected:**
- User clicks "Donate" QA button
- Frontend: Save as user message, show in UI
- Agent: "¿Cuánto te gustaría donar?" / "How much would you like to donate?"
- UI: Show QA buttons with suggested amounts ($500, $1.000, $2.500, $5.000) - **ONCE, after relevant bubble**

**Current Implementation:**
- ✅ `handleSendMessage(undefined, 'Quiero donar')` saves message
- ✅ Intent detected as "donate"
- ✅ `showDonationIntent: true` set when intent is "donate" AND no amount selected
- ✅ `suggestedDonationAmounts: [500, 1000, 2500, 5000]` set
- ✅ Frontend renders amount buttons
- ❌ **ISSUE**: Amount buttons disappearing after a few seconds
- ❌ **ISSUE**: Buttons rendering multiple times

#### Step 2: User Clicks Amount Button

**Expected:**
- User clicks amount QA button (e.g., "$1.000")
- Frontend: Save as user message (e.g., "Quiero donar $1000"), show in UI
- Agent: Explain how donation is made + provide alias instructions
- UI: Show QA copy button for alias - **ONCE, after relevant bubble**

**Current Implementation:**
- ✅ `handleDonationIntent(messageId, amount)` saves message with formatted amount
- ✅ Intent detected as "donate"
- ✅ `hasSelectedAmount` detected correctly
- ✅ `showBankingAlias: true` set when intent is "donate" AND amount selected
- ✅ Frontend renders alias copy button
- ❌ **ISSUE**: Alias button not rendering consistently
- ❌ **ISSUE**: Copy action saves as user message (should be hidden)

#### Step 3: User Clicks Alias Copy Button

**Expected:**
- User clicks alias copy button
- Frontend: Copy alias to clipboard
- Frontend: Save as user message (hidden, for analytics only)
- Agent: Ask if user wants to know more about verifying donation and getting Totitos

**Current Implementation:**
- ✅ `handleQuickAction(messageId, alias)` copies to clipboard
- ✅ `saveActionMessage('copy_alias', 'banking_alias', { alias })` saves hidden message
- ✅ Post-processing enforces Totitos question after amount selected
- ✅ Totitos question added: "¿Querés verificar tu donación y ganar Totitos?"
- ✅ Frontend filters out 'action' type messages from UI

---

### 3. Sharing Flow

#### Step 1: User Clicks "Share" Button

**Expected:**
- User clicks "Share" QA button
- Frontend: Save as user message, show in UI
- Agent: Acknowledge sharing intent
- UI: Show QA buttons (Instagram, Twitter, Facebook) - **ONCE, after relevant bubble**

**Current Implementation:**
- ✅ `handleSendMessage(undefined, 'Quiero compartir')` saves message
- ✅ Intent detected as "share"
- ✅ `showSocialMedia: true` set when intent is "share"
- ✅ Social media URLs built from guardian data
- ✅ Frontend renders social media buttons
- ❌ **ISSUE**: Buttons rendering multiple times

#### Step 2: User Clicks Social Media Button

**Expected:**
- User clicks social media QA button (e.g., Instagram)
- Frontend: Save as user message, show in UI
- Frontend: Open URL in browser/app

**Current Implementation:**
- ✅ `handleSocialMediaAction(messageId, url, platform)` saves message
- ✅ `saveActionMessage('share', platform, { url })` saves hidden analytics message
- ✅ `Linking.openURL(url)` opens URL
- ✅ Frontend shows user message in UI

---

### 4. Alternative Donation Methods Flow

**Expected:**
- User asks: "¿Hay otras formas de donar?" / "Are there other ways to donate?"
- Agent: Explain alternatives:
  - Donating to Toto (general)
  - Donating to multiple cases at the same time
  - Donating to the most urgent cases
- Agent: Explain TRF (Toto Rescue Fund)
- UI: Show TRF alias copy button (toto.fondo.rescate or betoto.pet)

**Current Implementation:**
- ❓ **NEEDS VERIFICATION**: How is alternative donation intent detected?
- ❓ **NEEDS VERIFICATION**: Is TRF alias shown when user asks for alternatives?
- ✅ KB entries exist for TRF and alternative methods
- ✅ KB entry `kb-donations-013` mentions TRF only when alias unavailable or user asks
- ❓ **QUESTION**: What is the exact TRF alias? `betoto.pet` or `toto.fondo.rescate`?

---

## Current Issues Identified

### Issue 1: QA Buttons Rendering Multiple Times
**Status:** 🔴 CRITICAL
- Help actions (Donate/Share) render once per bubble instead of once per message
- Donation amounts render once per bubble instead of once per message
- Social media buttons render once per bubble instead of once per message

**Root Cause:**
- Buttons are rendered inside `.map()` over messages
- Each bubble is a separate message, so buttons render for each bubble
- `renderedButtonsRef` tracking added but may not be working correctly

**Fix Applied:**
- Added `renderedButtonsRef` to track rendered buttons per `originalMessageId`
- Clear ref at start of render cycle
- Check ref before rendering
- Mark as rendered when actually rendered

**Status:** Needs testing

---

### Issue 2: Amount Buttons Disappearing
**Status:** 🔴 CRITICAL
- Amount buttons appear briefly then disappear

**Root Cause:**
- `isLastBubbleWithAmountQuestion` calculation may be incorrect
- `useEffect` tracking may not be marking amount buttons as shown
- Re-renders may be clearing the condition

**Fix Applied:**
- Updated tracking logic to check for `isLastBubbleWithAmountQuestion`
- Added `renderedButtonsRef` to prevent duplicates
- Simplified rendering condition to only check relevant bubble

**Status:** Needs testing

---

### Issue 3: Alias Button Not Rendering
**Status:** 🟡 MEDIUM
- Alias button not appearing after amount selected

**Root Cause:**
- `isFirstBubbleWithAlias` checks for text mentions, but AI may not include exact phrase
- `showBankingAlias` flag may not be set correctly

**Fix Applied:**
- Updated to check `showBankingAlias` flag directly, not just text
- Added tracking for alias buttons in `useEffect`
- Updated `isFirstBubbleWithAlias` to check flag in metadata

**Status:** Needs testing

---

## Questions for User

1. **TRF Alias**: What is the exact TRF banking alias?
   - `betoto.pet` (from KB backup)?
   - `toto.fondo.rescate` (mentioned in requirements)?
   - Something else?

2. **Alternative Donation Intent**: How should the agent detect when user wants alternative methods?
   - Keywords: "otras formas", "other ways", "alternativas"?
   - Should it be a separate intent or part of "donate" intent?

3. **Copy Action Message**: Currently saves as hidden 'action' type message. Is this correct?
   - Should it be completely silent (no message at all)?
   - Or is hidden analytics message OK?

4. **Totitos Question Timing**: Should Totitos question appear:
   - Immediately after alias is shown?
   - Only if user clicks copy button?
   - Or always after amount is selected?

5. **Button Persistence**: Once buttons are shown, should they:
   - Stay visible forever?
   - Disappear after user interacts?
   - Stay visible but become disabled?

---

## Test Results Summary

**Success Rate:** 68.8% (up from 54.2%)

**Passing:**
- ✅ Intent detection (multilingual embeddings working)
- ✅ Quick action flags set correctly
- ✅ Totitos question enforcement
- ✅ Alias button shown after amount

**Failing:**
- ❌ KB entries not always retrieved (semantic similarity issues)
- ❌ Response content not always matching expected phrases (LLM behavior)
- ❌ Some quick actions not rendering correctly (frontend issues)

---

## Next Steps

1. **Fix button rendering issues** (in progress)
2. **Verify TRF alias** (need user confirmation)
3. **Test alternative donation flow** (need to implement)
4. **Improve KB entry content** (add more query-matching phrases)
5. **Test end-to-end flows** (manual testing in app)

