/**
 * Analyze KB Migration - Extract and Compare
 * 
 * Extracts all hardcoded KB entries and compares with Firestore
 * Identifies: new entries, updates needed, potential duplicates
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { TotoAPIGateway } from '../src/gateway/TotoAPIGateway';

dotenv.config();

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
        path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json'),
        path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json')
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

const db = initializeFirebase();
const KB_COLLECTION = 'knowledge_base';

interface EntryAnalysis {
  id: string;
  title: string;
  category: string;
  status: 'new' | 'exists' | 'needs-update' | 'conflict';
  hardcoded: any;
  firestore?: any;
  differences?: string[];
  lastUpdated?: {
    hardcoded: string;
    firestore: string;
    newer: 'hardcoded' | 'firestore' | 'same' | 'unknown';
  };
  contentComparison?: {
    hardcodedLength: number;
    firestoreLength: number;
    similarity: 'identical' | 'different';
  };
}

async function analyzeKBEntries() {
  try {
    console.log('📊 Analyzing KB entries for migration...\n');
    
    // Extract hardcoded entries
    const apiGateway = new TotoAPIGateway();
    const hardcodedEntries = apiGateway.getHardcodedKnowledgeBase();
    
    console.log(`📚 Found ${hardcodedEntries.length} hardcoded entries\n`);
    
    // Get all Firestore entries
    const snapshot = await db.collection(KB_COLLECTION).get();
    const firestoreEntries = new Map<string, any>();
    snapshot.forEach(doc => {
      firestoreEntries.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    console.log(`📊 Found ${firestoreEntries.size} entries in Firestore\n`);
    
    // Analyze each entry
    const analysis: EntryAnalysis[] = [];
    const byCategory = new Map<string, EntryAnalysis[]>();
    
    for (const hardcoded of hardcodedEntries) {
      const firestore = firestoreEntries.get(hardcoded.id);
      
      let status: EntryAnalysis['status'];
      const differences: string[] = [];
      
      // Compare timestamps to determine which is newer
      const hardcodedTime = hardcoded.lastUpdated ? new Date(hardcoded.lastUpdated).getTime() : 0;
      const firestoreTime = firestore?.lastUpdated ? new Date(firestore.lastUpdated).getTime() : 0;
      
      let newer: 'hardcoded' | 'firestore' | 'same' | 'unknown' = 'unknown';
      if (hardcodedTime > 0 && firestoreTime > 0) {
        if (hardcodedTime > firestoreTime) newer = 'hardcoded';
        else if (firestoreTime > hardcodedTime) newer = 'firestore';
        else newer = 'same';
      } else if (hardcodedTime > 0) newer = 'hardcoded';
      else if (firestoreTime > 0) newer = 'firestore';
      
      if (!firestore) {
        status = 'new';
      } else {
        // Compare content
        const contentDiff = hardcoded.content !== firestore.content;
        const titleDiff = hardcoded.title !== firestore.title;
        const categoryDiff = hardcoded.category !== firestore.category;
        
        if (contentDiff || titleDiff || categoryDiff) {
          // If content differs, check which is newer
          if (contentDiff) {
            // Content conflict - need to determine which is correct
            // For now, mark as 'conflict' if Firestore is newer, 'needs-update' if hardcoded is newer
            if (newer === 'firestore' && contentDiff) {
              status = 'conflict'; // Firestore is newer - needs manual review
            } else {
              status = 'needs-update'; // Hardcoded is newer or same - can update
            }
          } else {
            status = 'needs-update'; // Only metadata differs
          }
          
          if (contentDiff) differences.push('content');
          if (titleDiff) differences.push('title');
          if (categoryDiff) differences.push('category');
        } else {
          status = 'exists';
        }
      }
      
      const entryAnalysis: EntryAnalysis = {
        id: hardcoded.id,
        title: hardcoded.title,
        category: hardcoded.category,
        status,
        hardcoded,
        firestore,
        differences: differences.length > 0 ? differences : undefined,
        lastUpdated: firestore ? {
          hardcoded: hardcoded.lastUpdated || 'unknown',
          firestore: firestore.lastUpdated || 'unknown',
          newer
        } : undefined,
        contentComparison: firestore ? {
          hardcodedLength: hardcoded.content?.length || 0,
          firestoreLength: firestore.content?.length || 0,
          similarity: hardcoded.content === firestore.content ? 'identical' : 'different'
        } : undefined
      };
      
      analysis.push(entryAnalysis);
      
      // Group by category
      if (!byCategory.has(hardcoded.category)) {
        byCategory.set(hardcoded.category, []);
      }
      byCategory.get(hardcoded.category)!.push(entryAnalysis);
    }
    
    // Generate report
    console.log('='.repeat(80));
    console.log('📋 MIGRATION ANALYSIS REPORT');
    console.log('='.repeat(80));
    
    const newEntries = analysis.filter(e => e.status === 'new');
    const needsUpdate = analysis.filter(e => e.status === 'needs-update');
    const conflicts = analysis.filter(e => e.status === 'conflict');
    const exists = analysis.filter(e => e.status === 'exists');
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Already exists (no changes): ${exists.length}`);
    console.log(`   ✏️  Needs update (hardcoded is newer): ${needsUpdate.length}`);
    console.log(`   ⚠️  CONFLICTS (Firestore is newer - needs review): ${conflicts.length}`);
    console.log(`   ➕ New entries: ${newEntries.length}`);
    console.log(`   📦 Total: ${analysis.length}`);
    
    // Show by category
    console.log(`\n📁 By Category:`);
    for (const [category, entries] of byCategory.entries()) {
      const newCount = entries.filter(e => e.status === 'new').length;
      const updateCount = entries.filter(e => e.status === 'needs-update').length;
      const existCount = entries.filter(e => e.status === 'exists').length;
      console.log(`   ${category}: ${entries.length} entries (${newCount} new, ${updateCount} update, ${existCount} exist)`);
    }
    
    // Show new entries
    if (newEntries.length > 0) {
      console.log(`\n➕ NEW ENTRIES (${newEntries.length}):`);
      newEntries.forEach(e => {
        console.log(`   - ${e.id}: ${e.title} [${e.category}]`);
      });
    }
    
    // Show entries needing update
    if (needsUpdate.length > 0) {
      console.log(`\n✏️  ENTRIES NEEDING UPDATE (${needsUpdate.length}):`);
      needsUpdate.forEach(e => {
        console.log(`   - ${e.id}: ${e.title} [${e.category}]`);
        console.log(`     Differences: ${e.differences?.join(', ')}`);
        if (e.lastUpdated) {
          console.log(`     Hardcoded updated: ${e.lastUpdated.hardcoded}`);
          console.log(`     Firestore updated: ${e.lastUpdated.firestore}`);
          console.log(`     ⬆️  Hardcoded is newer - safe to update`);
        }
      });
    }
    
    // Show conflicts (Firestore is newer)
    if (conflicts.length > 0) {
      console.log(`\n⚠️  CONFLICTS - NEEDS MANUAL REVIEW (${conflicts.length}):`);
      conflicts.forEach(e => {
        console.log(`   - ${e.id}: ${e.title} [${e.category}]`);
        console.log(`     ⚠️  WARNING: Firestore content is NEWER than hardcoded!`);
        if (e.lastUpdated) {
          console.log(`     Hardcoded updated: ${e.lastUpdated.hardcoded}`);
          console.log(`     Firestore updated: ${e.lastUpdated.firestore}`);
          console.log(`     ⬆️  Firestore is newer - review before overwriting`);
        }
        if (e.contentComparison) {
          console.log(`     Hardcoded length: ${e.contentComparison.hardcodedLength} chars`);
          console.log(`     Firestore length: ${e.contentComparison.firestoreLength} chars`);
        }
        console.log(`     💡 ACTION: Review both versions and decide which to keep`);
      });
    }
    
    // Save detailed report to file
    const reportPath = path.join(__dirname, '../kb-migration-report.json');
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: analysis.length,
        new: newEntries.length,
        needsUpdate: needsUpdate.length,
        conflicts: conflicts.length,
        exists: exists.length
      },
      entries: analysis.map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        status: e.status,
        differences: e.differences
      })),
      newEntries: newEntries.map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        agentTypes: e.hardcoded.agentTypes,
        audience: e.hardcoded.audience
      })),
      needsUpdate: needsUpdate.map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        differences: e.differences,
        lastUpdated: e.lastUpdated
      })),
      conflicts: conflicts.map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        differences: e.differences,
        lastUpdated: e.lastUpdated,
        contentComparison: e.contentComparison,
        warning: 'Firestore is newer - manual review required before overwriting'
      }))
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
    // Export hardcoded entries to JSON for reference
    const exportPath = path.join(__dirname, '../kb-hardcoded-entries.json');
    fs.writeFileSync(exportPath, JSON.stringify(hardcodedEntries, null, 2));
    console.log(`💾 Hardcoded entries exported to: ${exportPath}`);
    
    console.log(`\n✅ Analysis complete!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Review the report: ${reportPath}`);
    if (conflicts.length > 0) {
      console.log(`   2. ⚠️  MANUAL REVIEW REQUIRED: ${conflicts.length} conflicts detected`);
      console.log(`      - Review conflicts in the report`);
      console.log(`      - Decide which version to keep (hardcoded vs Firestore)`);
      console.log(`      - Update Firestore manually or modify hardcoded entries`);
    }
    console.log(`   ${conflicts.length > 0 ? '3' : '2'}. Run: npm run migrate-knowledge-base (to sync non-conflicting entries)`);
    console.log(`   ${conflicts.length > 0 ? '4' : '3'}. Verify: npm run verify-kb-entries`);
    
    console.log(`\n💡 Migration Strategy:`);
    console.log(`   - New entries: Will be added to Firestore`);
    console.log(`   - Needs update: Will update Firestore (hardcoded is newer)`);
    console.log(`   - Conflicts: SKIPPED - requires manual review`);
    console.log(`   - Exists: No action needed`);
    
  } catch (error) {
    console.error('❌ Error analyzing KB entries:', error);
    process.exit(1);
  }
}

analyzeKBEntries().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

