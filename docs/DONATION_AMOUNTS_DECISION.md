# Donation Amount Buttons - Decision Guide

## Current Implementation

**Location:** `toto-ai-hub/src/agents/CaseAgent.ts:612`

**Current Values:** `[1000, 5000, 10000, null]` (3 amounts + "Otro monto" = 4 buttons)

**Status:** Hardcoded, same for all cases

---

## How Amounts Are Currently Determined

### 1. **Hardcoded Values**
- Fixed amounts: $500, $1,000, $2,500 ARS
- Same for all cases, all users, all contexts
- No customization based on case urgency, target amount, or user history

### 2. **Source of Truth**
- **Golden Conversations:** Most show `$500, $1,000, $2,000` (3 amounts)
- **KB Entries:** Mention `$500, $1,000, $2,500, $5,000` as typical ranges
- **Current Code:** Uses `$500, $1,000, $2,500` (middle ground)

---

## Options for Determining Amounts

### Option 1: Keep Hardcoded (Current)
**Pros:**
- Simple, predictable
- Consistent UX across all cases
- No additional logic needed

**Cons:**
- Not personalized
- Doesn't adapt to case needs
- May not match user expectations

**When to use:** If simplicity is priority and amounts work for most cases

---

### Option 2: Case-Based Amounts
**Logic:**
- Use case data to determine appropriate amounts
- Consider: `targetAmount`, `donationsReceived`, `status` (urgent vs normal)

**Example:**
```typescript
function getDonationAmounts(caseData: CaseData): number[] {
  const target = caseData.targetAmount || 0;
  const received = caseData.donationsReceived || 0;
  const remaining = target - received;
  
  if (caseData.status === 'urgent') {
    // Higher amounts for urgent cases
    return [1000, 2500, 5000, null];
  }
  
  if (remaining < 5000) {
    // Lower amounts if close to goal
    return [500, 1000, 2000, null];
  }
  
  // Default amounts
  return [500, 1000, 2500, null];
}
```

**Pros:**
- Contextually relevant
- Adapts to case needs
- Better UX for users

**Cons:**
- More complex logic
- Need to handle edge cases
- Requires case data structure

---

### Option 3: User History-Based
**Logic:**
- Analyze user's past donations
- Suggest amounts similar to their typical donation range

**Example:**
```typescript
function getDonationAmounts(userProfile: UserProfile): number[] {
  const pastDonations = userProfile.interactionHistory
    .flatMap(i => i.actions)
    .filter(a => a.type === 'donation')
    .map(a => a.amount);
  
  if (pastDonations.length === 0) {
    return [500, 1000, 2500, null]; // Default
  }
  
  const avg = pastDonations.reduce((a, b) => a + b, 0) / pastDonations.length;
  
  // Suggest amounts around user's average
  if (avg < 1000) {
    return [500, 1000, 2000, null];
  } else if (avg < 2500) {
    return [1000, 2500, 5000, null];
  } else {
    return [2500, 5000, 10000, null];
  }
}
```

**Pros:**
- Personalized experience
- Higher conversion potential
- Better user engagement

**Cons:**
- Requires user history data
- Privacy considerations
- More complex implementation

---

### Option 4: Analytics-Based
**Logic:**
- Use aggregate analytics data
- Show most commonly selected amounts

**Example:**
```typescript
function getDonationAmounts(analytics: Analytics): number[] {
  // Get top 3 most selected amounts from analytics
  const topAmounts = analytics.getTopDonationAmounts(3);
  return [...topAmounts, null]; // Add "Otro monto"
}
```

**Pros:**
- Data-driven
- Optimized for conversion
- Adapts over time

**Cons:**
- Requires analytics infrastructure
- Need sufficient data
- May not work for new cases

---

### Option 5: Hybrid Approach (Recommended)
**Logic:**
- Combine multiple factors
- Fallback to defaults if data unavailable

**Example:**
```typescript
function getDonationAmounts(
  caseData: CaseData,
  userProfile?: UserProfile,
  analytics?: Analytics
): number[] {
  // Priority 1: Case-specific (if urgent or has target)
  if (caseData.status === 'urgent' && caseData.targetAmount) {
    const remaining = caseData.targetAmount - (caseData.donationsReceived || 0);
    if (remaining > 10000) {
      return [1000, 2500, 5000, null];
    }
  }
  
  // Priority 2: User history (if available)
  if (userProfile?.interactionHistory) {
    const userAmounts = getUserBasedAmounts(userProfile);
    if (userAmounts) return userAmounts;
  }
  
  // Priority 3: Analytics (if available)
  if (analytics) {
    const analyticsAmounts = getAnalyticsBasedAmounts(analytics);
    if (analyticsAmounts) return analyticsAmounts;
  }
  
  // Priority 4: Default (current hardcoded)
  return [1000, 5000, 10000, null];
}
```

**Pros:**
- Best of all worlds
- Flexible and adaptable
- Graceful degradation

**Cons:**
- Most complex to implement
- Requires multiple data sources
- Need to prioritize logic

---

## Recommendation

### Short Term (Current)
**Keep hardcoded values:** `[1000, 5000, 10000, null]`
- Matches golden conversations (mostly)
- Simple and reliable
- Works for MVP

### Medium Term (Next Phase)
**Add case-based logic:**
- Check if case is `urgent` → show higher amounts
- Check if case has `targetAmount` → adjust based on remaining
- Fallback to defaults if no case data

### Long Term (Future Enhancement)
**Implement hybrid approach:**
- Case-based + user history + analytics
- A/B testing to optimize
- Continuous improvement based on data

---

## Implementation Notes

### Current Golden Conversation Pattern
Most golden conversations show:
- **3 amount buttons:** `$500, $1,000, $2,000`
- **1 "Otro monto" button:** `null`

### Current Code Pattern
- **3 amount buttons:** `$1,000, $5,000, $10,000`
- **1 "Otro monto" button:** `null`

### Difference
- Golden conversations use `$2,000` as third amount
- Current code uses `$2,500` as third amount
- **Consideration:** Should we match golden conversations exactly (`$2,000`) or keep current (`$2,500`)?

---

## Questions to Consider

1. **Should amounts be case-specific?**
   - Urgent cases → higher amounts?
   - Cases close to goal → lower amounts?

2. **Should amounts be user-specific?**
   - Based on past donations?
   - Based on user profile/tier?

3. **Should amounts be currency-specific?**
   - ARS vs USD vs other currencies?
   - Different amounts for different markets?

4. **Should amounts be configurable?**
   - Admin panel to set amounts per case?
   - Guardian can suggest amounts?

5. **Should we match golden conversations exactly?**
   - Change `$2,500` to `$2,000` to match golden conversations?

---

## Next Steps

1. **Decide on approach** (hardcoded vs case-based vs hybrid)
2. **If case-based:** Define logic and thresholds
3. **If user-based:** Design user history tracking
4. **If analytics-based:** Set up analytics collection
5. **Update code** accordingly
6. **Test** with various cases and users
7. **Monitor** and iterate based on data

