# KB Entries for Manual Review

This folder contains new Knowledge Base entries to be reviewed and added manually.

## Structure

- `conversation-flows/` - How the agent should conduct conversations (7 entries) - **HIGH PRIORITY**
- `business-rules/` - Business policies and rules (2 entries) - **MEDIUM PRIORITY**
- `product-features/` - Product feature explanations (3 entries) - **MEDIUM PRIORITY**
- `conversation-guidelines/` - General conversation guidelines (2 entries)

## Review Process

For each JSON file:

1. **Review the content carefully**
   - Does the content make sense?
   - Is the language appropriate (Spanish/English)?
   - Are the instructions clear and actionable?

2. **Test the content**
   - Consider how the AI will interpret this
   - Will it lead to good user experiences?
   - Are there any ambiguities?

3. **Add to Firestore**
   - Option A: Via toto-bo dashboard (AI Hub → Knowledge Base → Add Entry)
   - Option B: Via Firebase Console (toto-bo project → Firestore → knowledge_base collection)
   - Option C: Use the API endpoint (POST /api/kb/entries)

4. **Verify**
   - Check that `usageCount` starts at 0
   - Verify `agentTypes` and `audience` are correct
   - Test RAG retrieval if possible

## Priority Order

### Start with HIGH PRIORITY (Conversation Flows):
These directly impact user experience and fix current conversation issues.

1. ✅ `conversation-flows/01-donation-intent.json`
2. ✅ `conversation-flows/02-donation-amount-selected.json`
3. ✅ `conversation-flows/04-sharing-intent.json`
4. ✅ `conversation-flows/05-help-seeking.json`
5. ✅ `conversation-flows/06-affirmative-response.json`
6. ✅ `conversation-flows/07-adoption-foster-inquiry.json`
7. ✅ `conversation-flows/03-donation-verification.json`

### Then MEDIUM PRIORITY (Business Rules & Features):
These provide consistent information but are less critical.

8. ✅ `business-rules/01-donation-amounts.json`
9. ✅ `business-rules/02-minimum-donation.json`
10. ✅ `product-features/01-trf-definition.json`
11. ✅ `product-features/02-totitos-system.json`
12. ✅ `product-features/03-donation-verification.json`

### Finally (Conversation Guidelines):
These are general best practices.

13. ✅ `conversation-guidelines/01-first-message.json`
14. ✅ `conversation-guidelines/02-conversation-progression.json`

## Notes

- Each JSON file follows the KnowledgeItem schema
- IDs are prefixed by category (`kb-flow-`, `kb-rules-`, `kb-feature-`, `kb-guide-`)
- All entries target `CaseAgent` and `donors` audience (adjustable)
- Content can be edited after adding via Firestore or toto-bo dashboard

## After Adding All Entries

1. Run sync to Vertex AI Search:
   ```bash
   npm run sync-kb-to-vertex
   ```

2. Test RAG retrieval with sample queries

3. Update CaseAgent to use PromptBuilder (next phase)

4. Remove hardcoded content from prompts
