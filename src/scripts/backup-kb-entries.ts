/**
 * KB Backup Script
 *
 * Creates a complete backup of all KB entries before making any changes.
 * This allows us to restore if anything goes wrong.
 *
 * Run with: npx ts-node src/scripts/backup-kb-entries.ts
 */

import * as admin from 'firebase-admin';
import { KnowledgeBaseService, KnowledgeItem } from '../services/KnowledgeBaseService';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    const totoBoKeyPath = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;

    if (totoBoKeyPath) {
      try {
        const serviceAccount = JSON.parse(totoBoKeyPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        }, 'toto-bo');
        return admin.app('toto-bo').firestore();
      } catch (error) {
        console.error('❌ Failed to initialize with toto-bo credentials');
        throw error;
      }
    } else {
      // Fallback for local development
      const localPaths = [
        path.join(__dirname, '../../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json'),
        path.join(__dirname, '../../toto-bo-firebase-adminsdk-fbsvc-138f229598.json')
      ];

      for (const localPath of localPaths) {
        if (fs.existsSync(localPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(localPath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          console.log(`✅ Using local service account: ${path.basename(localPath)}`);
          return admin.firestore();
        }
      }

      throw new Error('No Firebase credentials found');
    }
  }
  return admin.firestore();
};

/**
 * Main backup function
 */
async function backupKBEntries() {
  console.log('💾 Starting KB Backup\n');

  try {
    // Initialize Firebase
    const firestoreDb = initializeFirebase();
    const kbService = new KnowledgeBaseService(firestoreDb);

    // Initialize KB service
    await kbService.initialize();
    console.log('✅ KB Service initialized\n');

    // Get all entries
    const allEntries = await kbService.getAll();
    console.log(`📊 Total KB entries to backup: ${allEntries.length}\n`);

    // Create backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupDir = path.join(__dirname, `../../kb-backups/backup-${timestamp}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Save complete backup as single JSON
    const backupPath = path.join(backupDir, 'all-entries.json');
    fs.writeFileSync(backupPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalEntries: allEntries.length,
      entries: allEntries
    }, null, 2));
    console.log(`✅ Complete backup saved: ${backupPath}`);

    // Save individual entry files for easy review
    const individualDir = path.join(backupDir, 'individual-entries');
    if (!fs.existsSync(individualDir)) {
      fs.mkdirSync(individualDir, { recursive: true });
    }

    for (const entry of allEntries) {
      const entryPath = path.join(individualDir, `${entry.id}.json`);
      fs.writeFileSync(entryPath, JSON.stringify(entry, null, 2));
    }
    console.log(`✅ Individual entry files saved: ${individualDir}`);

    // Create backup manifest
    const manifestPath = path.join(backupDir, 'BACKUP_MANIFEST.md');
    const manifest = `# Knowledge Base Backup

**Date:** ${new Date().toISOString()}
**Total Entries:** ${allEntries.length}

## Backup Contents

1. \`all-entries.json\` - Complete backup of all KB entries
2. \`individual-entries/\` - Individual JSON files for each entry
3. \`BACKUP_MANIFEST.md\` - This file

## Entries by Category

${Object.entries(
  allEntries.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
).map(([category, count]) => `- **${category}**: ${count} entries`).join('\n')}

## Entry IDs

${allEntries.map(e => `- \`${e.id}\` - ${e.title}`).join('\n')}

## How to Restore

To restore this backup:

\`\`\`bash
npx ts-node src/scripts/restore-kb-backup.ts kb-backups/backup-${timestamp}/all-entries.json
\`\`\`

Or restore individual entries via toto-bo dashboard or Firebase Console.

## Verification

Before restoring, verify:
- [ ] All ${allEntries.length} entries present
- [ ] Content is readable and complete
- [ ] Metadata (agentTypes, audience, category) intact
- [ ] No corruption or data loss

---

**⚠️ Important:** Keep this backup safe before making any changes to KB entries!
`;

    fs.writeFileSync(manifestPath, manifest);
    console.log(`✅ Backup manifest created: ${manifestPath}`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 BACKUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Backed up: ${allEntries.length} entries`);
    console.log(`📁 Backup location: ${backupDir}`);
    console.log(`📄 Manifest: ${manifestPath}`);
    console.log('='.repeat(80));
    console.log('\n✅ Backup completed successfully!');
    console.log('\n🎯 Next steps:');
    console.log('1. Verify backup files are readable');
    console.log('2. Proceed with KB conversion (safe to modify now)');
    console.log('3. Keep this backup until changes are verified\n');

  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup
if (require.main === module) {
  backupKBEntries()
    .then(() => {
      console.log('✅ Backup script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backup script failed:', error);
      process.exit(1);
    });
}

export { backupKBEntries };
