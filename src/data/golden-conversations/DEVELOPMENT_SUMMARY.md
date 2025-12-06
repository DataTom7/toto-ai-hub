# Golden Conversation Dataset Development Summary

## Overview

This document summarizes the creation and iterative refinement of the Golden Conversation Dataset for Few-Shot Learning, designed to improve `CaseAgent` AI quality through curated example conversations.

## Initial Requirements

The user requested creation of ~50 curated example conversations showing ideal `CaseAgent` interactions with the following requirements:

- **Realistic conversations**: Natural language, typos, informal speech
- **Quick action buttons**: Matching actual `toto-bo` UX
- **Full coverage**: All intents (donation, share, help, information, edge cases)
- **Bilingual**: Both Spanish and English
- **Complexity mix**: Simple single-turn and complex multi-turn conversations
- **Review status**: All start with `"reviewed": false` (user manually flips to `true`)
- **Easy to edit**: JSON format
- **Full coverage**: All intents, languages, case types, edge cases

## Dataset Structure Created

### Directory Structure
```
src/data/golden-conversations/
├── donation/          (20 conversations)
├── share/            (10 conversations)
├── help/             (10 conversations)
├── information/      (10 conversations)
├── edge-cases/       (10 conversations)
├── __tests__/        (Test suite)
├── schema.ts         (TypeScript interfaces & validation)
├── index.ts          (Loader functions)
└── REVIEW_GUIDE.md   (Review guidelines)
```

### Core Files Created

1. **`schema.ts`**: Defines `GoldenConversation` interface and `validateGoldenConversation` function
2. **`index.ts`**: Loader functions:
   - `loadGoldenConversations()` - Load all conversations
   - `loadReviewedGoldenConversations()` - Load only reviewed
   - `getGoldenConversationsByIntent()` - Filter by intent
   - `getGoldenConversationsByLanguage()` - Filter by language
   - `getGoldenConversationStats()` - Get statistics
3. **`__tests__/goldenConversations.test.ts`**: Comprehensive test suite
4. **`REVIEW_GUIDE.md`**: Guidelines for reviewing conversations
5. **50+ JSON conversation files**: Organized by category

## Iterative Refinement Process

### Phase 1: Initial Creation
- Created all 50+ conversation files with initial structure
- Established schema and validation
- Set up loader functions and test suite

### Phase 2: Conversation Review & Refinement

The user reviewed conversations one at a time, providing feedback that led to systematic improvements:

#### Key Feedback Patterns & Fixes

**1. Quick Action Button Structure**
- **Issue**: Initial conversations didn't properly reflect how quick action buttons generate messages
- **Fix**: Updated all conversations to show multi-turn flows where users click buttons (e.g., "Donar" → sends "Quiero donar" → agent asks → user clicks amount button → sends "Quiero donar $1.000")

**2. Banking Alias vs TRF Alias**
- **Issue**: Agent was providing TRF alias (`toto.fondo.rescate`) instead of guardian alias
- **Fix**: Changed all donation conversations to use `[guardian-alias]` placeholder and provide guardian's banking alias

**3. Donation Verification Flow**
- **Issue**: Agent was asking for proof/receipt instead of asking about verification/totitos
- **Fix**: Updated to ask "¿Querés saber cómo verificar tu donación y recibir tus totitos?" with KB integration

**4. Message Formatting**
- **Issue**: Agent messages included bullet points for amounts/options
- **Fix**: Removed all bullet points since amounts and options are rendered as quick action buttons

**5. KB Integration**
- **Issue**: Unclear when KB content should be included
- **Fix**: Established pattern:
  - `shouldIncludeKB: true` when agent provides KB content (donation verification, totitos, sharing process, general help)
  - `shouldIncludeKB: false` when agent only uses information from `caseData`
  - KB query specified in message metadata when KB is used

**6. Multi-Turn Flow Standardization**
- **Issue**: Inconsistent single-turn vs multi-turn flows
- **Fix**: Standardized donation flows:
  - User: "Quiero donar" (from button)
  - Agent: Asks for amount with quick action buttons
  - User: "Quiero donar $X" (from amount button or typed)
  - Agent: Provides alias and asks about verification

**7. Amount Formatting Variations**
- **Issue**: All amounts used same format
- **Fix**: Added realistic variations for "Otro monto" input:
  - "100" (no dollar sign)
  - "$1500" (no thousands separator)
  - "$ 600" (space after dollar sign)
  - "$3,000" (English-style comma in Spanish conversation)

**8. Share Intent Updates**
- **Issue**: Agent was suggesting message templates for sharing
- **Fix**: Updated to ask for platform only; quick action buttons share case URL directly to Instagram, Twitter, or Facebook

**9. Help Intent Simplification**
- **Issue**: Agent messages included bullet points and unnecessary quick actions
- **Fix**: Removed bullets, removed "Contactar guardián" and "Más información" buttons; only "Donar" and "Compartir" remain

**10. Information Intent Clarification**
- **Issue**: "Más detalles" was a quick action button
- **Fix**: Removed "Más detalles" button; user must explicitly say "Quiero saber más" to get detailed information

**11. Edge Case Refinements**
- **Multiple Intents**: Extended to show full sequential flow (donation → verification → sharing)
- **Empty Follow-up**: Updated to show KB content after user confirms
- **Mixed Language**: Converted to multi-turn flow
- **Invalid Amount**: Removed explicit amounts from error message
- **No sé Amount**: Removed bullet points from suggestion message

### Phase 3: Schema Evolution

The `expectedResponse` structure evolved during refinement:

**Initial Structure:**
```typescript
expectedResponse: {
  intent: string;
  confidence: number;
  suggestedActions: Array<...>;
  shouldIncludeKB?: boolean;
}
```

**Final Structure:**
```typescript
expectedResponse: {
  intent: string;
  confidence: number;
  messages: Array<{
    message: string;
    quickActions?: {
      showBankingAlias?: boolean;
      guardianBankingAlias?: string;
      showAmountOptions?: boolean;
      amountOptions?: Array<{label: string; amount: number | null}>;
      showShareActions?: boolean;
      sharePlatform?: string;
      showHelpActions?: boolean;
    };
    shouldIncludeKB?: boolean;
    kbQuery?: string;
  }>;
  suggestedActions?: Array<...>; // Kept for backward compatibility
  shouldIncludeKB?: boolean; // Top-level flag
}
```

## Final Dataset Statistics

- **Total Conversations**: 50+
- **Donation**: 20 conversations (Spanish & English, various amounts, categories)
- **Share**: 10 conversations (Spanish & English, various platforms)
- **Help**: 10 conversations (Spanish & English, various question types)
- **Information**: 10 conversations (Spanish & English, various information requests)
- **Edge Cases**: 10 conversations (large amounts, typos, mixed language, ambiguous, off-topic, etc.)

## Key Patterns Established

### Donation Flow Pattern
1. User: "Quiero donar" (from button)
2. Agent: Asks for amount with quick action buttons
3. User: "Quiero donar $X" (from button or typed)
4. Agent: Provides guardian banking alias
5. Agent: Asks about verification/totitos (KB integration)

### Share Flow Pattern
1. User: "Quiero compartir" (from button)
2. Agent: Asks for platform
3. Quick Actions: Instagram, Twitter, Facebook buttons (share case URL directly)

### Help Flow Pattern
1. User: Asks how to help
2. Agent: Explains donation and sharing options
3. Quick Actions: "Donar" and "Compartir" buttons only

### Information Flow Pattern
1. User: Asks for information
2. Agent: Provides information from `caseData`
3. Agent: Suggests donation/sharing options
4. If user says "Quiero saber más": Agent provides detailed information including last case update

## Quality Assurance

- All conversations validated against schema
- Test suite ensures:
  - Required fields present
  - Valid intents and languages
  - Coverage of all intents, languages, complexities
  - Minimum 50 conversations
  - Schema validation passes

## Review Status

- All conversations start with `"reviewed": false`
- User manually reviews and flips to `"reviewed": true`
- Review process documented in `REVIEW_GUIDE.md`

## Lessons Learned

1. **Quick Action Buttons**: Always show as separate interactions in conversation flow
2. **KB Integration**: Only use when providing additional knowledge beyond `caseData`
3. **Message Formatting**: Never include amounts/options in text when they're rendered as buttons
4. **Multi-Turn Flows**: Standardize flows to match actual UX behavior
5. **Realistic Variations**: Include typos, informal language, and format variations
6. **Consistency**: Maintain consistent patterns across all conversation types

## Next Steps

1. User reviews remaining conversations and marks as `"reviewed": true`
2. Dataset used for few-shot learning in `CaseAgent`
3. Monitor AI quality improvements
4. Iterate based on production performance

## Files Modified During Refinement

### Donation Conversations (20 files)
- All updated to multi-turn flows
- Guardian alias instead of TRF alias
- KB integration for verification/totitos
- Amount formatting variations

### Share Conversations (10 files)
- Removed message templates
- Platform selection only
- Instagram, Twitter, Facebook buttons

### Help Conversations (10 files)
- Removed bullet points
- Removed "Contactar guardián" and "Más información"
- Only "Donar" and "Compartir" buttons

### Information Conversations (10 files)
- Removed "Más detalles" button
- Multi-turn flow for "Quiero saber más"
- KB integration only when appropriate

### Edge Cases (10 files)
- Multiple intents: Full sequential flow
- Empty follow-up: KB content after confirmation
- Mixed language: Multi-turn flow
- Invalid amount: No explicit amounts in error message
- No sé amount: No bullet points

## Conclusion

The golden conversation dataset was created through an iterative process of:
1. Initial creation based on requirements
2. User review and feedback
3. Systematic refinement based on feedback
4. Pattern establishment and consistency
5. Quality assurance and validation

The final dataset provides comprehensive coverage of all `CaseAgent` interaction patterns, ready for use in few-shot learning to improve AI quality.

