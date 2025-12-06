# Golden Conversations Review Guide

## What Are Golden Conversations?

Golden conversations are curated examples of ideal interactions between users and CaseAgent. They serve as:
- **Training examples** for few-shot learning (improving AI quality)
- **Quality benchmarks** for evaluation
- **Documentation** of expected behavior

## How to Review

### 1. Check Realism

**User Messages:**
- ✅ Use natural, informal language
- ✅ Include typos/lowercase where realistic
- ✅ Match actual user patterns
- ❌ Avoid overly formal language

**Examples:**
✅ "Quiero donar $1000"
✅ "quiero ayudar"
✅ "$500"
❌ "I would like to make a donation of $1000 to this case"

### 2. Check Agent Responses

**Quality Criteria:**
- ✅ Warm, empathetic tone
- ✅ Actionable instructions
- ✅ Includes quick action buttons
- ✅ Appropriate length (not too short, not too long)
- ❌ No robotic/formal language
- ❌ No unnecessary information

**Edit if needed!** Make the agent sound natural and helpful.

### 3. Check Quick Action Buttons

Every response should include appropriate quick actions:

**Donation Intent:**
- If amount specified → "Confirmar $X" + "Enviar comprobante"
- If no amount → Amount buttons ($500, $1000, $2000, Otro)

**Share Intent:**
- Platform buttons (WhatsApp, Instagram, Copiar)

**Help Intent:**
- All available actions (Donar, Compartir, Contactar, Más info)

**Information Intent:**
- Related actions (Donar, Compartir, Más detalles)

### 4. Mark as Reviewed

When done reviewing a file:

1. Edit the agent message if needed
2. Adjust quick action buttons if needed
3. Add notes if helpful
4. Set `"reviewed": true`
5. Optionally add `"qualityScore": 1-5`

```json
{
  "metadata": {
    ...
    "reviewed": true,
    "reviewNotes": "Perfect example of donation with amount",
    "qualityScore": 5
  }
}
```

### 5. Flag for Deletion

If a conversation isn't realistic or useful:

```json
{
  "metadata": {
    ...
    "reviewed": true,
    "reviewNotes": "DELETE - Not realistic",
    "qualityScore": 1
  }
}
```

## Quality Scoring (Optional)

- 5 - Perfect example, use as-is
- 4 - Great, minor edits needed
- 3 - Good, but needs work
- 2 - Useful but not ideal
- 1 - Delete or major rework needed

## Coverage Checklist

Ensure we have examples for:

**Intents:**
- Donation with amount (ES/EN)
- Donation without amount (ES/EN)
- Amount only (ES/EN)
- Share (ES/EN)
- Help (ES/EN)
- Information requests (ES/EN)

**Edge Cases:**
- Very large amounts
- Invalid inputs
- Ambiguous messages
- Multi-turn conversations
- Off-topic questions

**Case Types:**
- Rescue
- Surgery
- Treatment
- Transit
- Foster

## Questions?

Add notes in the "reviewNotes" field and we'll discuss!

