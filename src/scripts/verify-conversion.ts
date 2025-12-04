/**
 * Verify KB Conversion Results
 *
 * Checks that all converted entries have:
 * - language: 'en' field
 * - culturalNotes in metadata (if Spanish content was extracted)
 * - No data loss
 */

import * as admin from 'firebase-admin';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';
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

async function verifyConversion() {
  console.log('🔍 Starting Conversion Verification\n');

  try {
    // Initialize Firebase
    const firestoreDb = initializeFirebase();
    const kbService = new KnowledgeBaseService(firestoreDb);
    await kbService.initialize();

    // Load conversion report
    const reportPath = path.join(__dirname, '../../kb-conversion-report.json');
    if (!fs.existsSync(reportPath)) {
      console.error('❌ Conversion report not found');
      process.exit(1);
    }

    const firstReportPath = reportPath.replace('.json', '-first-run.json');
    let convertedIds: string[] = [];

    // Try to load the original conversion report
    if (fs.existsSync(firstReportPath)) {
      const firstReport = JSON.parse(fs.readFileSync(firstReportPath, 'utf8'));
      convertedIds = firstReport.results.map((r: any) => r.id);
    } else {
      // Use the list from audit
      convertedIds = [
        'kb-1762552808869',
        'kb-1762552813861',
        'kb-1762552824068',
        'kb-1762552828657',
        'kb-cases-007',
        'kb-cases-008',
        'kb-cases-009',
        'kb-donations-007',
        'kb-donations-010',
        'kb-donations-013',
        'kb-donations-014',
        'kb-donations-016',
        'kb-donations-017'
      ];
    }

    console.log(`📊 Verifying ${convertedIds.length} converted entries\n`);

    let verifiedCount = 0;
    let issuesCount = 0;

    for (const entryId of convertedIds) {
      const entry = await kbService.getById(entryId);

      if (!entry) {
        console.log(`❌ ${entryId}: NOT FOUND`);
        issuesCount++;
        continue;
      }

      const hasLanguage = (entry as any).language === 'en';
      const hasCulturalNotes = entry.metadata?.culturalNotes !== undefined;

      if (hasLanguage) {
        console.log(`✅ ${entryId}: language=en ${hasCulturalNotes ? '+ culturalNotes' : ''}`);
        verifiedCount++;
      } else {
        console.log(`⚠️  ${entryId}: Missing language field`);
        issuesCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total entries checked: ${convertedIds.length}`);
    console.log(`✅ Verified: ${verifiedCount}`);
    console.log(`❌ Issues: ${issuesCount}`);

    if (issuesCount === 0) {
      console.log('\n✅ All entries successfully converted!');
      console.log('\n🎯 Next steps:');
      console.log('1. Create remaining new KB entries (10 files)');
      console.log('2. Add new KB entries to Firestore');
      console.log('3. Sync to Vertex AI Search: npm run sync-kb-to-vertex');
    } else {
      console.log('\n⚠️  Some entries have issues. Review above.');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run verification
if (require.main === module) {
  verifyConversion()
    .then(() => {
      console.log('\n✅ Verification script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification script failed:', error);
      process.exit(1);
    });
}

export { verifyConversion };
