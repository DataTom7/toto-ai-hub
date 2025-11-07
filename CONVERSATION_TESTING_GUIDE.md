# Conversation Testing Guide

## Overview

This guide helps you analyze the 10 conversation simulations to identify improvement opportunities in the CaseAgent.

## How to Run

1. **Start the toto-ai-hub server:**
   ```powershell
   cd toto-ai-hub
   npm run dev
   ```
   Server should be running on `http://localhost:8080`

2. **Run the test script:**
   ```powershell
   cd toto-ai-hub
   .\test-conversations-v2.ps1
   ```

3. **Review results:**
   - Check console output for real-time responses
   - Review `conversation-results-v2.json` for full conversation logs

## Test Scenarios

### Conversation 1: Affirmative Response Loop Test
**Purpose:** Verify the bug fix we just implemented

**What to check:**
- ✅ Does agent progress conversation after "Si" responses?
- ✅ Does agent avoid repeating the same case introduction?
- ✅ Does agent move to actionable steps (how to help, donation process)?
- ❌ Does agent repeat case info multiple times? (This would indicate the fix didn't work)

**Expected behavior:**
- First "Si": Agent should explain HOW to help (donation steps, sharing, etc.)
- Second "Si": Agent should ask specific questions or provide concrete next steps
- Third "Si": Agent should continue progressing, not loop

---

### Conversation 2: Vague Questions
**Purpose:** Test agent's ability to guide users who don't know what to ask

**What to check:**
- ✅ Does agent provide clear, actionable options?
- ✅ Does agent ask clarifying questions?
- ✅ Does agent offer multiple ways to help?
- ❌ Does agent get stuck or ask user to be more specific without helping?

**Expected behavior:**
- Agent should proactively suggest ways to help
- Agent should provide clear next steps
- Agent should be helpful even with vague queries

---

### Conversation 3: Emotional User (Worried)
**Purpose:** Test empathy and emotional intelligence

**What to check:**
- ✅ Does agent acknowledge user's concern?
- ✅ Does agent provide reassurance (without making medical promises)?
- ✅ Does agent offer urgent action options?
- ❌ Does agent ignore emotional cues?
- ❌ Does agent make promises about outcomes?

**Expected behavior:**
- Agent should show empathy
- Agent should provide urgent help options
- Agent should be honest about what it can/can't guarantee

---

### Conversation 4: Information Overload Request
**Purpose:** Test agent's ability to provide digestible information

**What to check:**
- ✅ Does agent break down information into digestible chunks?
- ✅ Does agent prioritize most important information?
- ✅ Can agent clarify specific points when asked?
- ❌ Does agent dump too much information at once?
- ❌ Does agent get confused when asked to clarify?

**Expected behavior:**
- Agent should provide structured, prioritized information
- Agent should be able to clarify specific points
- Agent should avoid overwhelming the user

---

### Conversation 5: Topic Change
**Purpose:** Test agent's ability to adapt to changing user intent

**What to check:**
- ✅ Does agent smoothly transition from adoption to donation?
- ✅ Does agent acknowledge the change in intent?
- ✅ Does agent provide relevant information for new topic?
- ❌ Does agent get confused or stuck?
- ❌ Does agent continue talking about old topic?

**Expected behavior:**
- Agent should acknowledge the change
- Agent should smoothly transition to new topic
- Agent should provide relevant information for new intent

---

### Conversation 6: Fully Funded Case
**Purpose:** Test handling of completed/fully-funded cases

**What to check:**
- ✅ Does agent acknowledge case is fully funded?
- ✅ Does agent explain that additional donations still help?
- ✅ Does agent suggest other ways to help?
- ❌ Does agent discourage donations unnecessarily?
- ❌ Does agent not mention the case is fully funded?

**Expected behavior:**
- Agent should acknowledge funding status
- Agent should explain that additional support still helps
- Agent should offer alternative ways to help

---

### Conversation 7: Minimal Responses
**Purpose:** Test agent's ability to handle very short user messages

**What to check:**
- ✅ Does agent understand intent from minimal responses?
- ✅ Does agent still progress conversation?
- ✅ Does agent ask clarifying questions when needed?
- ❌ Does agent get stuck on short responses?
- ❌ Does agent ask for more detail without helping?

**Expected behavior:**
- Agent should infer intent from context
- Agent should progress conversation naturally
- Agent should be helpful even with minimal input

---

### Conversation 8: Technical Questions
**Purpose:** Test accuracy of technical information

**What to check:**
- ✅ Does agent explain verification process correctly?
- ✅ Does agent correctly explain direct transfer (NOT through platform)?
- ✅ Does agent provide accurate information about donation process?
- ❌ Does agent say donations go "through the platform"? (WRONG)
- ❌ Does agent provide incorrect information?

**Expected behavior:**
- Agent should explain direct bank transfer to guardian alias
- Agent should explain verification process accurately
- Agent should NOT say money goes through platform

---

### Conversation 9: Multiple Help Options
**Purpose:** Test agent's knowledge of all ways to help

**What to check:**
- ✅ Does agent suggest multiple ways to help (donate, share, adopt)?
- ✅ Does agent explain sharing helps?
- ✅ Does agent mention Totitos for sharing?
- ❌ Does agent only suggest donations?
- ❌ Does agent dismiss sharing as not helpful?

**Expected behavior:**
- Agent should suggest multiple ways to help
- Agent should explain that sharing is valuable
- Agent should mention Totitos system

---

### Conversation 10: Missing Information
**Purpose:** Test graceful handling of incomplete case data

**What to check:**
- ✅ Does agent handle missing information gracefully?
- ✅ Does agent offer alternatives (TRF) when alias is missing?
- ✅ Does agent explain what information is missing?
- ❌ Does agent break or give errors?
- ❌ Does agent make up information?

**Expected behavior:**
- Agent should acknowledge missing information
- Agent should offer alternatives (TRF)
- Agent should be honest about what it doesn't know

---

## Common Issues to Look For

### 🔴 Critical Issues
1. **Repeating same information** - Agent loops on same content
2. **Incorrect donation process** - Says "through platform" instead of "direct transfer"
3. **Wrong TRF translation** - Says "Transferencia Rápida de Fondos" instead of "Fondo de Rescate de Toto"
4. **Missing banking alias** - Doesn't provide alias when available
5. **Making up information** - Inventing case details not provided

### 🟡 Medium Issues
1. **Not progressing conversation** - Stuck in same place
2. **Not adapting to user style** - Too formal/casual for user
3. **Missing empathy** - Doesn't acknowledge emotions
4. **Information overload** - Too much at once
5. **Not offering alternatives** - Only suggests one option

### 🟢 Minor Issues
1. **Awkward phrasing** - Could be more natural
2. **Too verbose** - Could be more concise
3. **Missing context** - Doesn't reference previous messages
4. **Generic responses** - Not personalized enough

## Analysis Template

For each conversation, document:

```markdown
### Conversation X: [Scenario Name]

**Issues Found:**
- [ ] Issue 1: Description
- [ ] Issue 2: Description

**What Worked Well:**
- ✅ Good point 1
- ✅ Good point 2

**Recommendations:**
1. Suggestion 1
2. Suggestion 2

**Severity:** 🔴 Critical / 🟡 Medium / 🟢 Minor
```

## Next Steps After Testing

1. **Document all issues** in a markdown file
2. **Prioritize fixes** by severity
3. **Create tickets** for each issue
4. **Test fixes** with same scenarios
5. **Iterate** until all critical issues are resolved

