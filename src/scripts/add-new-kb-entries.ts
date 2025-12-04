/**
 * Add New KB Entries Script
 *
 * Adds the 14 new English-only KB entries to Firestore
 * from the kb-entries-to-review directory.
 *
 * Run with: npx ts-node src/scripts/add-new-kb-entries.ts [--dry-run]
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
 * Recursively find all JSON files in a directory
 */
function findJsonFiles(dir: string): string[] {
  let results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(findJsonFiles(filePath));
    } else if (file.endsWith('.json')) {
      results.push(filePath);
    }
  }

  return results;
}

/**
 * Load all KB entry files from kb-entries-to-review directory
 */
function loadKBEntryFiles(): Array<{ filePath: string; entry: any }> {
  const reviewDir = path.join(__dirname, '../../kb-entries-to-review');

  // Find all JSON files recursively
  const files = findJsonFiles(reviewDir);

  console.log(`📂 Found ${files.length} KB entry files\n`);

  const entries: Array<{ filePath: string; entry: any }> = [];

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const entry = JSON.parse(content);
      entries.push({ filePath, entry });
    } catch (error) {
      console.error(`❌ Error reading ${filePath}:`, error);
    }
  }

  return entries;
}

/**
 * Validate KB entry structure
 */
function validateEntry(entry: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!entry.id) errors.push('Missing id');
  if (!entry.title) errors.push('Missing title');
  if (!entry.content) errors.push('Missing content');
  if (!entry.category) errors.push('Missing category');
  if (!entry.agentTypes) errors.push('Missing agentTypes');
  if (!entry.audience) errors.push('Missing audience');
  if (!entry.language) errors.push('Missing language field');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Main function to add new KB entries
 */
async function addNewKBEntries() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log('📚 Adding New KB Entries');
  console.log(`Mode: ${isDryRun ? '🔍 DRY-RUN (preview only)' : '✅ LIVE (will add to Firestore)'}`);
  console.log();

  try {
    // Load all KB entry files
    const entryFiles = loadKBEntryFiles();

    if (entryFiles.length === 0) {
      console.log('⚠️  No KB entry files found in kb-entries-to-review/');
      return;
    }

    // Initialize Firebase
    const firestoreDb = initializeFirebase();
    const kbService = new KnowledgeBaseService(firestoreDb);
    await kbService.initialize();
    console.log('✅ KB Service initialized\n');

    // Track results
    const results: Array<{
      id: string;
      filePath: string;
      success: boolean;
      action: 'added' | 'updated' | 'skipped' | 'error';
      message: string;
    }> = [];

    // Process each entry
    for (const { filePath, entry } of entryFiles) {
      const fileName = path.basename(filePath);
      console.log('='.repeat(80));
      console.log(`📄 ${fileName}`);
      console.log('='.repeat(80));

      // Validate entry
      const validation = validateEntry(entry);
      if (!validation.valid) {
        console.log(`❌ Validation failed:`);
        validation.errors.forEach(err => console.log(`   - ${err}`));
        results.push({
          id: entry.id || 'unknown',
          filePath: fileName,
          success: false,
          action: 'error',
          message: `Validation failed: ${validation.errors.join(', ')}`
        });
        continue;
      }

      console.log(`ID: ${entry.id}`);
      console.log(`Title: ${entry.title}`);
      console.log(`Category: ${entry.category}`);
      console.log(`Language: ${entry.language}`);
      console.log(`Has cultural notes: ${entry.metadata?.culturalNotes ? 'Yes' : 'No'}`);

      // Check if entry already exists
      const existing = await kbService.getById(entry.id);

      if (existing) {
        console.log(`⚠️  Entry already exists in Firestore`);

        if (!isDryRun) {
          console.log(`🔄 Updating existing entry...`);
          const updateData: any = {
            title: entry.title,
            content: entry.content,
            category: entry.category,
            agentTypes: entry.agentTypes,
            audience: entry.audience,
            metadata: entry.metadata
          };
          if (entry.language) {
            updateData.language = entry.language;
          }
          await kbService.update(entry.id, updateData);
          console.log('✅ Updated!');
          results.push({
            id: entry.id,
            filePath: fileName,
            success: true,
            action: 'updated',
            message: 'Entry updated in Firestore'
          });
        } else {
          console.log('🔍 DRY-RUN: Would update existing entry');
          results.push({
            id: entry.id,
            filePath: fileName,
            success: true,
            action: 'updated',
            message: 'Would update (dry-run)'
          });
        }
      } else {
        if (!isDryRun) {
          console.log(`➕ Adding new entry...`);

          // Prepare entry for addition
          const newEntry: any = {
            id: entry.id,
            title: entry.title,
            content: entry.content,
            category: entry.category,
            agentTypes: entry.agentTypes,
            audience: entry.audience,
            metadata: entry.metadata || {}
          };

          // Add language field if present
          if (entry.language) {
            newEntry.language = entry.language;
          }

          await kbService.add(newEntry as KnowledgeItem);
          console.log('✅ Added!');
          results.push({
            id: entry.id,
            filePath: fileName,
            success: true,
            action: 'added',
            message: 'Entry added to Firestore'
          });
        } else {
          console.log('🔍 DRY-RUN: Would add new entry');
          results.push({
            id: entry.id,
            filePath: fileName,
            success: true,
            action: 'added',
            message: 'Would add (dry-run)'
          });
        }
      }

      console.log();
    }

    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total entries processed: ${results.length}`);
    console.log(`✅ Added: ${results.filter(r => r.action === 'added').length}`);
    console.log(`🔄 Updated: ${results.filter(r => r.action === 'updated').length}`);
    console.log(`❌ Errors: ${results.filter(r => r.action === 'error').length}`);

    if (isDryRun) {
      console.log('\n🔍 DRY-RUN MODE: No changes were applied to Firestore');
      console.log('\nTo apply these changes, run:');
      console.log('  npx ts-node src/scripts/add-new-kb-entries.ts');
    } else {
      console.log('\n✅ Changes applied to Firestore!');
      console.log('\n🎯 Next steps:');
      console.log('1. Verify entries in Firestore');
      console.log('2. Run: npm run sync-kb-to-vertex');
      console.log('3. Test with CaseAgent');
    }
    console.log('='.repeat(80));

    // Save report
    const reportPath = path.join(__dirname, '../../kb-entries-addition-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: isDryRun ? 'dry-run' : 'live',
      results
    }, null, 2));
    console.log(`\n📄 Report saved: ${reportPath}`);

  } catch (error) {
    console.error('\n❌ Operation failed:', error);
    process.exit(1);
  }
}

// Run script
if (require.main === module) {
  addNewKBEntries()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { addNewKBEntries };
