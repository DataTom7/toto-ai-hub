# New KB Entries Summary

**Created:** 2025-12-03
**Total New Entries:** 14 (4 updated + 10 new)
**Format:** English-only with cultural notes
**Location:** `kb-entries-to-review/`

---

## Entry Overview

All entries follow the standardized format:
- **language:** `en` (English-only content)
- **metadata.culturalNotes:** Spanish examples and tone guidance
- **content:** English instructions and guidelines
- **category:** Organized by functional area
- **agentTypes:** CaseAgent
- **audience:** Targeted user groups

---

## Conversation Flows (7 entries)

### 1. Donation Intent (kb-flow-donation-intent)
**File:** `conversation-flows/01-donation-intent.json`
**Purpose:** Guide users who express interest in donating
**Key Points:**
- Acknowledge intent warmly
- Clarify no minimum donation
- Ask about amount without pressure
- Don't provide alias until amount is selected

**Spanish Examples:** "¡Qué bueno que quieras ayudar!", "No hay un monto mínimo", "¿Cuánto te gustaría donar?"

---

### 2. Donation Amount Selected (kb-flow-donation-amount-selected)
**File:** `conversation-flows/02-donation-amount-selected.json`
**Purpose:** Handle when user commits to specific amount
**Key Points:**
- Express gratitude for commitment
- Explain transfer process (Mercado Pago, unique alias)
- CRITICAL: Never include alias in text, only via quick action
- Build trust with process explanation

**Spanish Examples:** "gracias", "cuenta"

---

### 3. Donation Verification (kb-flow-donation-verification)
**File:** `conversation-flows/03-donation-verification.json`
**Purpose:** Help users verify donation status
**Key Points:**
- Explain verification process and timing
- Direct to inbox for donation history
- Manage expectations (can take hours, up to 24h)
- Provide support escalation path

**Spanish Examples:** "verificar donación", "¿se acreditó?", "mi donación"

---

### 4. Sharing Intent (kb-flow-sharing-intent)
**File:** `conversation-flows/04-sharing-intent.json`
**Purpose:** Help users share cases on social media
**Key Points:**
- Explain HOW to share (Instagram, Twitter/X, Facebook)
- Ask platform preference
- Mention quick action buttons
- NEVER include actual social media handles or URLs in text
- Explain impact of sharing

**Spanish Examples:** "¡Qué bueno que quieras compartir!", "Puedes compartir el caso en Instagram, Twitter/X, o Facebook", "¿En qué plataforma te gustaría compartir?"

---

### 5. Help-Seeking Intent (kb-flow-help-seeking)
**File:** `conversation-flows/05-help-seeking.json`
**Purpose:** Respond to "How can I help?" questions
**Key Points:**
- Provide ACTIONABLE steps, not case description
- List concrete options: donate, share, adopt
- Let user choose their preferred way to help
- CRITICAL: Don't repeat case details when asked how to help

**Spanish Examples:** "¡Gracias por querer ayudar!", "haciendo una donación directa al guardián", "¿Cuál te gustaría conocer más?"

---

### 6. Affirmative Response (kb-flow-affirmative-response)
**File:** `conversation-flows/06-affirmative-response.json`
**Purpose:** Handle "yes", "ok", "si" responses
**Key Points:**
- CRITICAL: Never repeat the same question twice
- Acknowledge briefly and move forward
- Advance conversation, don't circle back
- Treat affirmative as confirmation to proceed

**Spanish Examples:** "Perfecto", "Excelente", "Genial", "¿Cuánto te gustaría donar?"

---

### 7. Adoption/Foster Inquiry (kb-flow-adoption-foster)
**File:** `conversation-flows/07-adoption-foster-inquiry.json`
**Purpose:** Handle adoption and fostering questions
**Key Points:**
- Explain Toto's role (connector, not handler)
- Direct to rescue organization for process
- Provide contact information
- Offer alternative support options

**Spanish Examples:** "quiero adoptar", "¿puedo acogerlo?", "adopción"

---

## Business Rules (2 entries)

### 1. Donation Amounts (kb-business-donation-amounts)
**File:** `business-rules/01-donation-amounts.json`
**Purpose:** Guidelines for presenting donation amount options
**Key Points:**
- Suggested amounts: $500, $1000, $2000, $5000, $10000, custom
- NO MINIMUM requirement (critical messaging)
- Amounts are suggestions, not obligations
- Emphasize accessibility and inclusivity

**Spanish Examples:** "pesos", "monto"

---

### 2. No Minimum Policy (kb-business-no-minimum)
**File:** `business-rules/02-minimum-donation.json`
**Purpose:** Explain no minimum donation policy
**Key Points:**
- Clear statement: no minimum exists
- Every amount is valuable
- Removes financial barriers
- Builds inclusive community

**Spanish Examples:** "mínimo", "cuánto tengo que donar"

---

## Product Features (3 entries)

### 1. Toto Rescue Fund (kb-product-trf-definition)
**File:** `product-features/01-trf-definition.json`
**Purpose:** Complete explanation of TRF
**Key Points:**
- Collective fund for emergency and operational support
- Covers veterinary care, rescue operations, rehab
- Flexible support for many animals vs. case-specific
- Transparent tracking and reporting

**Spanish Examples:** "Fondo de Rescate de Toto"

---

### 2. Totitos System (kb-product-totitos)
**File:** `product-features/02-totitos-system.json`
**Purpose:** Explain rewards/gamification system
**Key Points:**
- Virtual points for helping animals
- Earned through donations, sharing, engagement
- Recognition and community building
- NOT currency or redeemable for cash

**Spanish Examples:** "totitos", "puntos"

---

### 3. Donation Verification Process (kb-product-donation-verification)
**File:** `product-features/03-donation-verification.json`
**Purpose:** Complete verification and inbox system explanation
**Key Points:**
- Step-by-step: transfer → rescue verification → inbox appearance
- Timing: typically hours, up to 24h
- Inbox features: history, notifications, tracking
- Transparency: direct to rescue, no intermediaries

**Spanish Examples:** "verificación", "bandeja de entrada", "se acreditó"

---

## Conversation Guidelines (2 entries)

### 1. First Message Guidelines (kb-guidelines-first-message)
**File:** `conversation-guidelines/01-first-message.json`
**Purpose:** How to structure the first interaction
**Key Points:**
- Create emotional connection without manipulation
- Structure: greeting → animal intro → need → call to action
- Keep concise (3-5 sentences)
- Match user's language
- Avoid "I'm an AI", don't pressure

**Spanish Examples:** "Hola", "te cuento", "ayudarnos"

---

### 2. Conversation Progression (kb-guidelines-conversation-flow)
**File:** `conversation-guidelines/02-conversation-progression.json`
**Purpose:** Guide natural conversation flow
**Key Points:**
- 4 stages: Awareness → Consideration → Action → Completion
- Follow user's pace, don't rush
- Progressive disclosure of information
- Recognize intent shifts
- Be responsive, not scripted

**Spanish Examples:** "¿te gustaría?", "podemos", "estamos aquí"

---

## Technical Details

### Format Consistency
All entries include:
```json
{
  "id": "kb-[category]-[name]",
  "title": "Descriptive Title",
  "language": "en",
  "content": "English-only content...",
  "category": "category_name",
  "agentTypes": ["CaseAgent"],
  "audience": ["target_groups"],
  "metadata": {
    "culturalNotes": {
      "es": {
        "examples": ["Spanish phrase 1", "Spanish phrase 2"],
        "tone": "Tone description",
        "note": "Context and guidance"
      }
    }
  }
}
```

### Categories Used
- `conversation_flows` - User interaction patterns
- `business_rules` - Policies and guidelines
- `product_features` - Feature explanations
- `conversation_guidelines` - Communication principles

### Agent Integration
- All entries target **CaseAgent**
- Designed for RAG retrieval
- Semantic search compatibility
- Cacheable content structure

---

## Next Steps

1. **Review** - Validate all 14 entries for accuracy and completeness
2. **Add to Firestore** - Upload entries to knowledge_base collection
3. **Sync to Vertex AI** - Run `npm run sync-kb-to-vertex`
4. **CaseAgent Refactoring** - Replace hardcoded prompts with KB retrieval
5. **Testing** - Verify Spanish and English responses

---

## Benefits of This Structure

✅ **Centralized Knowledge** - All content in one place
✅ **English-Only Source** - Easier maintenance and updates
✅ **Cultural Awareness** - Preserves Spanish nuances
✅ **AI Translation** - Let AI handle runtime translation
✅ **Scalability** - Easy to add new languages (Portuguese, etc.)
✅ **Consistency** - Standardized format across all entries
✅ **Flexibility** - Update content without code changes
✅ **Version Control** - Track changes in JSON files

---

**Status:** Ready for review and Firestore upload
**Last Updated:** 2025-12-03
