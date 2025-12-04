# Knowledge Base Backup

**Date:** 2025-12-03T22:23:09.737Z
**Total Entries:** 32

## Backup Contents

1. `all-entries.json` - Complete backup of all KB entries
2. `individual-entries/` - Individual JSON files for each entry
3. `BACKUP_MANIFEST.md` - This file

## Entries by Category

- **social-media**: 1 entries
- **donations**: 19 entries
- **case-management**: 1 entries
- **case_management**: 9 entries
- **social_media**: 2 entries

## Entry IDs

- `kb-1762552808869` - How to Share Cases on Social Media
- `kb-1762552813861` - How to Verify Donations
- `kb-1762552824068` - TRF (Toto Rescue Fund) - How to Donate
- `kb-1762552828657` - Adoption Process - How It Works
- `kb-cases-001` - Case Creation Process
- `kb-cases-002` - Case Status Workflow
- `kb-cases-003` - Case Documentation
- `kb-cases-004` - Case Updates & Communication
- `kb-cases-005` - Case Categories
- `kb-cases-006` - Emergency Cases
- `kb-cases-007` - Agent Conversation Behavior Guidelines
- `kb-cases-008` - Agent Identity and Communication Voice
- `kb-cases-009` - CRITICAL: Use ONLY Provided Case Data - No Hallucination
- `kb-donations-001` - Banking Alias System
- `kb-donations-002` - Donation Verification Process
- `kb-donations-003` - Totitos Loyalty System - Complete Guide
- `kb-donations-004` - Donation Allocation Rules
- `kb-donations-005` - Donor Experience Overview
- `kb-donations-006` - Donation Amounts and Minimums
- `kb-donations-007` - Toto Rescue Fund (TRF)
- `kb-donations-008` - Donation Flow and Conversation Guidance
- `kb-donations-009` - User Rating and Totitos Calculation System
- `kb-donations-010` - Donor Inbox and Case Communication - Complete Post-Donation Experience
- `kb-donations-011` - Donation Refunds and Corrections
- `kb-donations-012` - Donation Allocation to Guardians
- `kb-donations-013` - Banking Alias Provision and Retrieval
- `kb-donations-014` - Missing Alias Scenarios and Alternative Donation Methods
- `kb-donations-015` - Donation Transparency and Verification Details
- `kb-donations-016` - Payment Methods and Feature Accuracy
- `kb-donations-017` - How to Explain Donation Process - Direct Transfer Only
- `kb-social-001` - Social Media Integration
- `kb-social-002` - Case Sharing Process

## How to Restore

To restore this backup:

```bash
npx ts-node src/scripts/restore-kb-backup.ts kb-backups/backup-2025-12-03/all-entries.json
```

Or restore individual entries via toto-bo dashboard or Firebase Console.

## Verification

Before restoring, verify:
- [ ] All 32 entries present
- [ ] Content is readable and complete
- [ ] Metadata (agentTypes, audience, category) intact
- [ ] No corruption or data loss

---

**⚠️ Important:** Keep this backup safe before making any changes to KB entries!
