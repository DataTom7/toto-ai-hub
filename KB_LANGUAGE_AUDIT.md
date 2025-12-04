# Knowledge Base Language Audit

## 🎯 Purpose

Audit all existing KB entries to identify which ones use bilingual patterns and need conversion to English-only for international scalability.

---

## 🔍 What the Audit Checks

The script analyzes each KB entry and categorizes it as:

### ✅ **English-Only** (GOOD)
- Content is entirely in English
- Ready for international use
- No changes needed

### ⚠️ **Bilingual** (NEEDS CONVERSION)
- Contains both Spanish and English
- Uses patterns like:
  - `Spanish: "¡Qué bueno..."`
  - `English: "That's wonderful..."`
  - `- Spanish: ...`
  - `- English: ...`
- Needs: Remove bilingual format, keep English only, add cultural notes

### ⚠️ **Spanish-Only** (NEEDS TRANSLATION)
- Content is entirely in Spanish
- Needs: Translate to English, add Spanish cultural notes

### 🟠 **Mixed** (MANUAL REVIEW)
- Mix of languages without clear pattern
- Needs: Manual review and conversion

---

## 🚀 How to Run

### **Option 1: Run in Staging (Recommended)**

```bash
# SSH/Cloud Shell into staging
cd toto-ai-hub
npm run audit-kb-languages
```

This will:
1. Connect to toto-bo Firestore
2. Analyze all KB entries
3. Print detailed report
4. Save results to `kb-language-audit-results.json`

### **Option 2: Run Locally (Requires Credentials)**

```bash
# Set environment variable
export TOTO_BO_SERVICE_ACCOUNT_KEY='{"type":"service_account"...}'

# Or place service account file in toto-ai-hub directory
# - toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json
# - toto-bo-firebase-adminsdk-fbsvc-138f229598.json

npm run audit-kb-languages
```

---

## 📊 Expected Output

```
🔍 Starting KB Language Audit

✅ KB Service initialized

📊 Total KB entries: 52

================================================================================
📊 LANGUAGE STRUCTURE SUMMARY
================================================================================
✅ English-only entries: 15
⚠️  Bilingual entries (need conversion): 32
⚠️  Spanish-only entries (need conversion): 3
❓ Mixed entries (need manual review): 2
❓ Unknown entries: 0
================================================================================

🔴 BILINGUAL ENTRIES (Need Conversion)
================================================================================

📄 kb-donations-001
   Title: Banking Alias System
   Category: donations
   Patterns found: Spanish label, English label
   Suggestions:
     - Convert to English-only with tone guidance
     - Remove language labels (Spanish:/English:)
     - Add cultural notes to metadata instead
   Content preview: BANKING ALIAS SETUP
- Each guardian/admin must complete their banking alias when creating their g...

📄 kb-donations-002
   Title: Donation Process
   Category: donations
   Patterns found: Dash Spanish, Dash English
   Suggestions:
     - Convert to English-only with tone guidance
     - Remove language labels (Spanish:/English:)
     - Add cultural notes to metadata instead
   Content preview: When user shows donation intent:
- Spanish: "¡Qué bueno que quieras ayudar!"
- English: "That's...

[... more entries ...]

================================================================================
📋 CONVERSION PLAN
================================================================================
Total entries to convert: 37

Options:
1. Create conversion script (recommended)
2. Manual conversion via toto-bo dashboard
3. Export entries, convert offline, re-import

Recommended: Create conversion script that:
  - Detects bilingual patterns
  - Extracts English content
  - Moves Spanish examples to cultural notes
  - Preserves all metadata
  - Updates entries in Firestore
================================================================================

✅ Results saved to: kb-language-audit-results.json

🎯 Next steps:
1. Review the audit results
2. Decide on conversion strategy
3. Run conversion script (if needed)
4. Test with multiple languages
```

---

## 📋 What Happens Next

### **If Many Bilingual Entries Found:**

I'll create a **conversion script** that automatically:
1. Extracts English content
2. Removes bilingual labels
3. Adds Spanish/Portuguese cultural notes to metadata
4. Updates entries in Firestore
5. Preserves all other data

### **Example Conversion:**

**Before (Bilingual):**
```json
{
  "id": "kb-donations-001",
  "content": "
    When user shows donation intent:
    1. ACKNOWLEDGE INTENT
       - Spanish: '¡Qué bueno que quieras ayudar!'
       - English: 'That's wonderful that you want to help!'

    2. CLARIFY NO MINIMUM
       - Spanish: 'No hay un monto mínimo'
       - English: 'There's no minimum amount'
  "
}
```

**After (English-Only + Cultural Notes):**
```json
{
  "id": "kb-donations-001",
  "content": "
    When user shows donation intent:
    1. ACKNOWLEDGE INTENT
       'That's wonderful that you want to help!'

    2. CLARIFY NO MINIMUM
       'There's no minimum amount - every donation helps!'
  ",
  "language": "en",
  "metadata": {
    "culturalNotes": {
      "es": {
        "tone": "Warm and enthusiastic",
        "examples": [
          "¡Qué bueno que quieras ayudar!",
          "No hay un monto mínimo, ¡cada ayuda cuenta!"
        ],
        "emphasis": "Use '¡cada ayuda cuenta!' to emphasize inclusivity"
      },
      "pt": {
        "tone": "Warm and friendly",
        "examples": [
          "Que legal que você quer ajudar!",
          "Não há valor mínimo"
        ]
      }
    }
  }
}
```

---

## 🎯 Decision Points

After running the audit, you'll need to decide:

### **1. Conversion Strategy**

**Option A: Automated Batch Conversion** (Fast)
- Create conversion script
- Run on all bilingual entries
- Review results
- **Time:** 2-3 hours total
- **Best for:** Many entries to convert (>20)

**Option B: Manual Conversion** (Safe)
- Convert each entry via toto-bo dashboard
- Review each one carefully
- Test as you go
- **Time:** 30 min per entry
- **Best for:** Few entries (<10) or sensitive content

**Option C: Hybrid** (Recommended)
- Auto-convert straightforward entries
- Manually review complex/mixed entries
- **Time:** 3-5 hours total
- **Best for:** Mix of simple and complex entries

### **2. Testing Strategy**

After conversion:
- [ ] Test with Spanish users (should work identically)
- [ ] Test RAG retrieval (verify entries are found)
- [ ] Test with English queries
- [ ] Prepare for Portuguese launch

---

## 📝 Files Generated

1. **kb-language-audit-results.json**
   - Complete audit results
   - Entry-by-entry analysis
   - Conversion suggestions

2. **kb-conversion-plan.md** (if needed)
   - Step-by-step conversion guide
   - Specific entries to update
   - Testing checklist

3. **kb-converted-entries/** (after conversion)
   - Backup of original entries
   - New English-only versions
   - Diff files showing changes

---

## ⚡ Quick Start

**Run the audit now:**
```bash
cd toto-ai-hub
npm run audit-kb-languages
```

**Then:**
1. Review the output
2. Check `kb-language-audit-results.json`
3. Decide on conversion strategy
4. Proceed with next steps

---

## 🤔 FAQ

**Q: Will this break existing functionality?**
A: No. The AI will translate at runtime, so Spanish users won't notice any difference.

**Q: What if the AI translation quality is poor?**
A: We can add specific translations to `metadata.culturalNotes` for critical phrases.

**Q: How long does conversion take?**
A: Audit: 2 minutes. Automated conversion: 10-20 minutes. Testing: 1-2 hours.

**Q: Can we revert if needed?**
A: Yes. The conversion script backs up original entries before making changes.

**Q: What about new languages (Portuguese, French, etc.)?**
A: Once entries are English-only, adding new languages requires:
  1. Add cultural notes to metadata (optional)
  2. Test with that language
  3. That's it! No code changes needed.

---

**Ready to run the audit?**

Let me know what you find, and I'll create the conversion script if needed!
