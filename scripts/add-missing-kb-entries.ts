/**
 * Script to add 8 missing KB entries identified in CONVERSATION_ANALYSIS_V2.md
 * 
 * These entries address critical gaps in agent responses:
 * - High Priority (4): Donation verification, TRF donation, Adoption process, Social media sharing
 * - Medium Priority (4): Totitos system, Emotional support, Case status types, Incomplete information handling
 * 
 * Usage:
 *   npx ts-node scripts/add-missing-kb-entries.ts [target-project]
 * 
 * Default target: toto-bo (shared KB location)
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

// Get target project from command line or use default
const targetProject = process.argv[2] || 'toto-bo';
const COLLECTION = 'knowledge_base';

// Determine which service account to use
let serviceAccount: any;
let projectId: string;

// Try to use TOTO_BO_SERVICE_ACCOUNT_KEY from environment (for deployed environments)
const serviceAccountKey = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;

if (serviceAccountKey) {
  try {
    serviceAccount = JSON.parse(serviceAccountKey);
    projectId = serviceAccount.project_id || 'toto-bo';
    console.log('📚 Using TOTO_BO_SERVICE_ACCOUNT_KEY from environment');
  } catch (error) {
    console.error('❌ Failed to parse TOTO_BO_SERVICE_ACCOUNT_KEY:', error);
    process.exit(1);
  }
} else {
  // Fallback to local service account files
  let serviceAccountPath: string;
  
  switch (targetProject) {
    case 'toto-bo':
      const prodPath = path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
      const stgPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
      if (fs.existsSync(prodPath)) {
        serviceAccountPath = prodPath;
        projectId = 'toto-bo';
      } else if (fs.existsSync(stgPath)) {
        serviceAccountPath = stgPath;
        projectId = 'toto-bo-stg';
      } else {
        console.error('❌ No toto-bo service account file found');
        process.exit(1);
      }
      break;
    case 'toto-bo-stg':
      serviceAccountPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
      projectId = 'toto-bo-stg';
      break;
    default:
      console.error(`❌ Unknown target project: ${targetProject}`);
      process.exit(1);
  }
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ Service account file not found`);
    process.exit(1);
  }
  
  serviceAccount = require(serviceAccountPath);
  console.log(`📚 Using local service account: ${serviceAccountPath}`);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: projectId
});

const db = admin.firestore();

interface KBEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  agentTypes: string[];
  audience: string[];
  lastUpdated: string;
  usageCount: number;
}

const missingEntries: KBEntry[] = [
  // HIGH PRIORITY
  {
    id: 'kb-donations-verification',
    title: 'How to Verify Donations',
    content: `# How to Verify Donations

## Overview
After making a donation via bank transfer to a guardian's banking alias, donors can verify their donation through the Toto platform to receive Totitos rewards.

## Verification Process

### Step 1: Make the Donation
- Complete a bank transfer to the guardian's banking alias (shown in the case details)
- Save the transfer receipt/comprobante from your bank

### Step 2: Upload the Receipt
- Go to the case page in the Toto app or website
- Look for the "Verify Donation" button or section
- Click "Upload Receipt" or "Verificar Donación"
- Select the transfer receipt image from your device
- Enter the donation amount and date
- Submit the verification request

### Step 3: Verification Timeline
- Verification typically takes 1-3 business days
- The guardian or Toto team reviews the receipt
- You'll receive a notification when verification is complete

### Step 4: Receive Totitos
- Once verified, Totitos are automatically added to your account
- The number of Totitos depends on the donation amount and your rating multiplier
- You can check your Totitos balance in your profile

## Important Notes
- Only verified donations earn Totitos
- Keep your transfer receipt until verification is complete
- If verification fails, you'll receive instructions on how to resubmit
- Direct contact with guardians is also possible, but platform verification is recommended for automatic Totitos

## Troubleshooting
- If you can't find the verification button, check that you're logged in
- Receipt must clearly show: amount, date, recipient alias, and your account
- Contact support if verification takes longer than 3 business days`,
    category: 'donations',
    agentTypes: ['CaseAgent', 'DonationAgent'],
    audience: ['donors'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'kb-donations-trf-guide',
    title: 'TRF (Toto Rescue Fund) - How to Donate',
    content: `# TRF (Toto Rescue Fund) - How to Donate

## What is TRF?
TRF (Toto Rescue Fund) is a general rescue fund used when:
- A guardian's banking alias is not yet available
- A case needs immediate funding but guardian details are incomplete
- Multiple cases need combined support
- Emergency situations require quick action

## TRF Banking Details
**Banking Alias:** [TRF_ALIAS_PLACEHOLDER]
**Account Name:** Toto Rescue Fund
**Purpose:** General animal rescue and emergency care

## When to Use TRF vs Guardian Alias

### Use TRF When:
- Guardian banking alias is not available
- Case information is incomplete but urgent
- You want to support multiple cases at once
- Emergency situations requiring immediate funding

### Use Guardian Alias When:
- Guardian banking alias is available (preferred)
- You want to support a specific case directly
- You want your donation to go directly to the guardian

## How to Donate to TRF

### Step 1: Get TRF Banking Alias
- TRF banking alias is displayed in case details when guardian alias is unavailable
- You can also find it in the app's donation section
- Contact support if you need the TRF alias

### Step 2: Make the Transfer
- Use your bank's transfer service (same as guardian donations)
- Enter the TRF banking alias as recipient
- Enter the donation amount
- Add a note: "TRF - [Case Name]" if donating for a specific case
- Complete the transfer

### Step 3: Verify Your Donation
- Follow the same verification process as guardian donations
- Upload your transfer receipt
- Specify which case(s) you want to support (if applicable)

## TRF Fund Distribution
- TRF funds are distributed to cases based on urgency and need
- Priority is given to urgent cases and emergency situations
- Funds may be allocated to multiple cases
- If you specify a case, efforts are made to allocate to that case when possible

## Important Notes
- TRF donations also earn Totitos after verification
- TRF is a transparent fund - you can see how funds are used
- TRF supports cases that might not have individual funding yet
- Guardian-specific donations are preferred when possible, but TRF ensures no case goes unfunded`,
    category: 'donations',
    agentTypes: ['CaseAgent', 'DonationAgent'],
    audience: ['donors'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'kb-case-management-adoption-process',
    title: 'Adoption Process - Step by Step Guide',
    content: `# Adoption Process - Step by Step Guide

## Overview
The adoption process connects potential adopters with animals in need of a permanent home. This guide explains how to initiate and complete the adoption process.

## Step 1: Find an Animal to Adopt
- Browse cases in the Toto app or website
- Look for animals marked as "available for adoption"
- Read the animal's story, needs, and requirements
- Check the guardian's contact information

## Step 2: Contact the Guardian
- Use the "Contact Guardian" button on the case page
- Or use the guardian's contact information provided
- Introduce yourself and express interest in adoption
- Be prepared to answer questions about your home, lifestyle, and experience

## Step 3: Initial Conversation
The guardian will likely ask about:
- Your living situation (house, apartment, yard, etc.)
- Other pets in the home
- Your experience with animals
- Your lifestyle and availability
- Why you're interested in this specific animal

## Step 4: Provide Required Information
Be ready to provide:
- Proof of residence
- References (veterinarian, previous adoptions, etc.)
- Information about your home environment
- Details about family members or other pets
- Your commitment to the animal's care

## Step 5: Meet the Animal (If Possible)
- Arrange a meeting with the guardian and animal
- This may be in person or via video call
- Ask questions about the animal's behavior, health, and needs
- Ensure the animal is a good fit for your home

## Step 6: Adoption Application
- Complete any required adoption forms
- Provide all requested documentation
- Be honest about your situation and capabilities

## Step 7: Home Visit (If Required)
- Some guardians may request a home visit
- This ensures the animal will have a safe environment
- Be open and welcoming during the visit

## Step 8: Adoption Agreement
- Review and sign the adoption agreement
- Understand your responsibilities as an adopter
- Clarify any questions before signing

## Step 9: Adoption Fee (If Applicable)
- Some cases may have an adoption fee
- This helps cover medical expenses and care
- Payment is typically made to the guardian or organization

## Step 10: Bringing the Animal Home
- Coordinate pickup or delivery with the guardian
- Ensure you have all necessary supplies ready
- Follow any care instructions provided
- Schedule a veterinary checkup soon after adoption

## Timeline Expectations
- Initial contact to first response: 1-3 days
- Application review: 3-7 days
- Home visit (if required): 1-2 weeks
- Final approval and adoption: 2-4 weeks total

## Important Notes
- Adoption processes vary by guardian and case
- Be patient - guardians want to ensure the best home
- Ask questions - it's important to find the right match
- Adoption is a commitment - ensure you're ready for the responsibility
- If adoption doesn't work out, contact the guardian immediately

## After Adoption
- Stay in touch with the guardian if they request updates
- Provide a loving, safe home for your new companion
- Seek help if you encounter challenges
- Remember: adoption saves lives!`,
    category: 'case_management',
    agentTypes: ['CaseAgent'],
    audience: ['donors', 'guardians'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'kb-social-media-sharing-guide',
    title: 'How to Share Cases on Social Media',
    content: `# How to Share Cases on Social Media

## Overview
Sharing cases on social media helps raise awareness and funding for animals in need. This guide explains how to share cases and earn Totitos for your efforts.

## Why Share Cases?
- Raise awareness about animals in need
- Help cases reach their funding goals faster
- Earn Totitos rewards for verified shares
- Connect with the animal rescue community
- Make a real difference in animals' lives

## How to Share Through the Platform

### Step 1: Find a Case to Share
- Browse cases in the Toto app or website
- Select a case you want to share
- Click the "Share" button (usually at the top or bottom of the case page)

### Step 2: Choose Sharing Method
The platform offers multiple sharing options:
- **Share Link**: Copy a direct link to the case
- **Share Image**: Download and share the case image
- **Share to Social Media**: Direct sharing buttons for Twitter, Instagram, Facebook, WhatsApp

### Step 3: Share on Your Platform
- **Twitter/X**: Click the Twitter button or copy the link and post with the case story
- **Instagram**: Download the case image and post with the case link in bio
- **Facebook**: Use the Facebook share button or post the link
- **WhatsApp**: Share the link directly with contacts or groups

### Step 4: Verify Your Share (For Totitos)
- After sharing, return to the case page
- Click "Verify Share" or "I Shared This"
- Select the platform where you shared
- Optionally provide a link to your post
- Submit verification

## What Gets Shared?
When you share a case, you're sharing:
- The case story and animal's information
- Photos of the animal
- Funding progress and goal
- Guardian contact information
- Direct donation link or banking alias

## Earning Totitos for Sharing
- Verified shares earn Totitos rewards
- Amount varies by platform and reach
- Verification is required to receive Totitos
- Multiple shares of the same case may have limits

## Best Practices for Sharing
- Add a personal message explaining why you care
- Use relevant hashtags (#AnimalRescue, #Toto, etc.)
- Tag friends who might be interested
- Share at optimal times for your audience
- Follow up if the case reaches its goal

## Platform-Specific Tips

### Twitter/X
- Use engaging images
- Include the case link
- Use relevant hashtags
- Tag @TotoRescue if applicable

### Instagram
- Post high-quality images
- Write a compelling caption
- Include the case link in bio or use link in bio tools
- Use Stories for additional visibility

### Facebook
- Share to relevant groups
- Add personal context
- Encourage friends to share further

## Verification Process
- Verification typically takes 1-2 days
- Platform may check your social media account
- Totitos are awarded after successful verification
- Contact support if verification fails

## Important Notes
- Respect the animal's and guardian's privacy
- Only share accurate information
- Don't share banking aliases publicly (use the platform link)
- Be respectful in your sharing messages`,
    category: 'social_media',
    agentTypes: ['CaseAgent', 'SharingAgent'],
    audience: ['donors'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0
  },
  // MEDIUM PRIORITY
  {
    id: 'kb-donations-totitos-complete-guide',
    title: 'Totitos System - Complete Guide',
    content: `# Totitos System - Complete Guide

## What are Totitos?
Totitos are a loyalty reward system that recognizes and rewards donors and supporters for their contributions to animal rescue efforts. They represent your impact and can be redeemed for various benefits.

## How to Earn Totitos

### Verified Donations
- **Base Totitos**: Earned based on donation amount
- **Rating Multiplier**: Your donor rating multiplies the base Totitos
- **Example**: A $100 donation with a 1.5x rating = 150 base Totitos × 1.5 = 225 Totitos

### Verified Social Media Shares
- Earn Totitos for sharing cases on social media
- Amount varies by platform and verification
- Multiple shares may have daily limits

### Other Activities
- Completing profiles
- Referring friends
- Long-term support recognition

## Rating Multiplier System
Your donor rating affects how many Totitos you earn:
- **New Donors**: 1.0x multiplier (base rate)
- **Regular Donors**: 1.2x - 1.5x multiplier
- **Top Supporters**: 1.5x - 2.0x multiplier
- Rating improves with consistent, verified donations

## Totitos Calculation
**Formula**: (Base Totitos × Rating Multiplier) = Total Totitos Earned

**Example**:
- Donation: $50
- Base Totitos: 50 (1 Totito per $1)
- Your Rating: 1.3x
- Total Earned: 50 × 1.3 = 65 Totitos

## Where to See Your Totitos
- **Profile Page**: Check your Totitos balance in your user profile
- **Dashboard**: View in the main dashboard
- **Transaction History**: See all Totitos earned and redeemed

## What Can You Do with Totitos?
- **Support More Cases**: Use Totitos to contribute to additional cases
- **Special Recognition**: Higher Totitos may unlock special recognition
- **Future Benefits**: Additional redemption options may be added

## Important Notes
- Totitos are only awarded for **verified** donations and shares
- Verification is required - unverified activities don't earn Totitos
- Totitos balance is permanent and doesn't expire
- Rating multiplier improves with consistent support
- Check your profile regularly to see your balance and rating

## Troubleshooting
- **Missing Totitos**: Ensure your donation/share was verified
- **Wrong Amount**: Check your rating multiplier in your profile
- **Not Showing**: Allow 1-3 days after verification for Totitos to appear
- **Questions**: Contact support if you have concerns about your Totitos balance`,
    category: 'donations',
    agentTypes: ['CaseAgent', 'DonationAgent'],
    audience: ['donors'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'kb-case-management-emotional-support',
    title: 'Handling Emotional Users - Empathy Guidelines',
    content: `# Handling Emotional Users - Empathy Guidelines

## Overview
When users express concern, worry, or emotional distress about an animal's situation, it's important to respond with empathy while providing accurate information and hope.

## Key Principles

### 1. Acknowledge Their Concern
- **Do**: "Entiendo tu preocupación por [animal name]"
- **Do**: "Es comprensible que te sientas preocupado/a"
- **Don't**: Dismiss or minimize their feelings
- **Don't**: Be overly clinical or detached

### 2. Provide Accurate Information
- Share what you know about the case status
- Be honest about what information is available
- Explain funding progress and what it means
- Clarify next steps and timeline

### 3. Offer Hope Without Promises
- **Do**: "Con el apoyo de la comunidad, [animal] tiene buenas posibilidades"
- **Do**: "Cada donación acerca más a [animal] a recibir la ayuda que necesita"
- **Don't**: Make specific promises about outcomes
- **Don't**: Guarantee results you can't control

### 4. Suggest Actionable Steps
- Guide them on how they can help
- Explain donation process clearly
- Suggest sharing the case on social media
- Provide clear next steps they can take

## Response Templates

### For Urgent Cases
"Entiendo tu preocupación. [Animal name] necesita [treatment] urgentemente. La buena noticia es que ya hemos recaudado [X]% del objetivo. Cada donación cuenta y nos acerca más a poder ayudar a [animal name]. ¿Te gustaría hacer una donación o compartir este caso?"

### For Cases with Limited Information
"Comprendo tu preocupación por [animal name]. Actualmente, la información disponible sobre su estado es limitada, pero puedo compartir lo que sabemos: [share available information]. La mejor manera de ayudar es [suggest actions]. ¿Hay algo específico en lo que pueda ayudarte?"

### For Emotional Distress
"Entiendo que esto es preocupante. [Animal name] está en buenas manos con [guardian name], quien está haciendo todo lo posible. La comunidad está unida para ayudar, y cada contribución marca la diferencia. ¿Te gustaría saber cómo puedes ayudar directamente?"

## What to Avoid

### Don't:
- Make promises you can't keep
- Provide false hope
- Be dismissive of concerns
- Share unverified information
- Pressure users into actions

### Do:
- Validate their feelings
- Provide accurate, available information
- Offer concrete ways to help
- Maintain a supportive tone
- Be honest about limitations

## When to Escalate
- User expresses severe emotional distress
- User threatens self-harm
- User is abusive or threatening
- Situation requires immediate attention
- Information needs verification before sharing

## Follow-Up
- Check if the user has more questions
- Offer additional resources if needed
- Thank them for their concern and support
- Keep the conversation focused on helping the animal

## Remember
- Empathy doesn't mean making false promises
- Honesty builds trust
- Actionable steps give users a sense of control
- Every interaction is an opportunity to help both the user and the animal`,
    category: 'case_management',
    agentTypes: ['CaseAgent'],
    audience: ['admin'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'kb-case-management-status-types',
    title: 'Case Status Types - What They Mean',
    content: `# Case Status Types - What They Mean

## Overview
Understanding case statuses helps donors and supporters know the current state of a case and what help is still needed.

## Status Types

### Active
**Meaning**: The case is ongoing and actively seeking funding
- Animal still needs help
- Funding goal has not been reached
- Donations are still being accepted
- Case is being actively managed

**What This Means for Donors**:
- Your donation will directly help this case
- Funding progress shows how close the case is to its goal
- Case is actively being worked on by the guardian

### Urgent
**Meaning**: The case requires immediate attention and funding
- Time-sensitive medical treatment needed
- Emergency situation
- Higher priority for funding
- May have a deadline for treatment

**What This Means for Donors**:
- Your donation is especially impactful right now
- Time is critical for the animal's wellbeing
- Immediate support can make a significant difference
- Sharing the case is particularly helpful

### Completed
**Meaning**: The case has reached its funding goal or the animal's needs have been met
- Funding goal has been reached
- Treatment has been completed
- Animal's immediate needs are met
- Case is no longer actively seeking donations

**What This Means for Donors**:
- Your donation can still help (see below)
- The animal has received the needed care
- Case may transition to follow-up care
- You can celebrate the successful outcome!

### Completed Cases - Can You Still Donate?
**Yes!** Even when a case is marked "completed":
- Donations may support follow-up care
- Help other animals in need
- Support the guardian's ongoing rescue work
- Contribute to the Toto Rescue Fund (TRF)

## Funding Progress Impact

### 0-25% Funded
- Case is just starting
- Every donation makes a significant impact
- Sharing is very helpful to reach more people
- Long way to go, but progress is being made

### 26-50% Funded
- Good progress, but still needs significant support
- Donations continue to be critical
- Case is gaining momentum
- Halfway point is a good milestone

### 51-75% Funded
- Strong progress toward goal
- Final push needed
- Donations are getting closer to the goal
- Sharing can help reach the finish line

### 76-99% Funded
- Almost there!
- Final donations can complete the goal
- Very close to success
- Every contribution matters

### 100% Funded
- Goal reached! (May still accept donations)
- Treatment can proceed
- Animal will receive needed care
- Additional donations may support follow-up

## Status Changes

### When Status Changes
- Status updates as funding progresses
- Guardian or system updates status
- Status reflects current case needs
- Changes are visible in real-time

### What to Expect
- Active cases may become urgent if time-sensitive
- Urgent cases become active after immediate needs are met
- Active cases become completed when goal is reached
- Completed cases may have follow-up needs

## Important Notes
- Status is updated by guardians and the system
- Funding progress is shown as a percentage
- Status doesn't always reflect all case details
- Contact guardian for specific questions about case status
- Even "completed" cases may benefit from additional support`,
    category: 'case_management',
    agentTypes: ['CaseAgent'],
    audience: ['donors'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'kb-case-management-incomplete-info',
    title: 'Handling Incomplete Case Information',
    content: `# Handling Incomplete Case Information

## Overview
Sometimes cases may have incomplete information (missing banking alias, guardian details, etc.). This guide explains how to handle these situations and still help effectively.

## Common Missing Information

### Missing Banking Alias
**What This Means**:
- Guardian's banking alias is not yet available
- Case may be new or alias is being set up
- Donation process may be delayed

**What to Do**:
- **Option 1**: Use TRF (Toto Rescue Fund) - available immediately
- **Option 2**: Wait for alias to become available (check back later)
- **Option 3**: Contact the guardian directly if contact info is available
- **Option 4**: Share the case to help raise awareness while waiting

**When to Use TRF**:
- Case is urgent and needs immediate funding
- Guardian alias is not available and case can't wait
- You want to support the case right away
- Multiple cases need combined support

**When to Wait**:
- Case is not urgent
- Guardian alias should be available soon
- You prefer direct donation to guardian
- You can check back in a few days

### Missing Guardian Contact Information
**What This Means**:
- Guardian's contact details are not available
- May be a new case or privacy concern
- Direct contact may not be possible

**What to Do**:
- Use platform messaging if available
- Donate through available channels (alias or TRF)
- Share the case to help raise awareness
- Check case updates for new information

### Missing Case Details
**What This Means**:
- Some case information may be incomplete
- Medical details, timeline, or other specifics may be missing
- Case may be in early stages

**What to Do**:
- Work with available information
- Donate or share based on what you know
- Check for case updates regularly
- Contact support if you have specific questions

## Best Practices

### For Donors
1. **Use Available Options**: If alias is missing, use TRF
2. **Check Back**: Information may be added later
3. **Don't Wait**: If case is urgent, use TRF to help immediately
4. **Ask Questions**: Contact support if you need clarification

### For Agents
1. **Be Transparent**: Explain what information is missing
2. **Offer Alternatives**: Suggest TRF when alias is unavailable
3. **Provide Context**: Explain why information might be missing
4. **Guide Users**: Help them make decisions with available information

## TRF vs Guardian Alias

### When to Recommend TRF
- Banking alias is not available
- Case is urgent and can't wait
- User wants to donate immediately
- Multiple cases need support

### When to Recommend Waiting
- Case is not time-sensitive
- Guardian alias should be available soon
- User prefers direct donation
- User can check back later

## Getting Updates

### How to Stay Informed
- Check the case page regularly for updates
- Enable notifications if available
- Follow the guardian on social media (if provided)
- Contact support for specific questions

### What Updates to Expect
- Banking alias may be added
- Case details may be completed
- Status may change
- Funding progress will update

## Communication Guidelines

### What to Say
- "El alias bancario aún no está disponible, pero puedes usar el TRF"
- "La información del caso se está completando, pero puedes ayudar ahora"
- "Puedes donar a través del TRF mientras esperamos el alias del guardián"
- "Te notificaremos cuando el alias esté disponible"

### What Not to Say
- Don't make promises about when information will be available
- Don't discourage donations because information is incomplete
- Don't suggest the case is not legitimate
- Don't create false urgency

## Important Notes
- Incomplete information doesn't mean the case isn't legitimate
- TRF is a valid and important donation option
- Cases are often updated as information becomes available
- Your support is valuable even with incomplete information
- Contact support if you have concerns about case legitimacy`,
    category: 'case_management',
    agentTypes: ['CaseAgent', 'DonationAgent'],
    audience: ['donors', 'admin'],
    lastUpdated: new Date().toISOString(),
    usageCount: 0
  }
];

async function addMissingEntries() {
  console.log('🚀 Starting to add missing KB entries...\n');
  console.log(`📚 Target project: ${projectId}`);
  console.log(`📚 Collection: ${COLLECTION}\n`);

  try {
    // Check existing entries
    const existingSnapshot = await db.collection(COLLECTION).get();
    const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id));
    
    console.log(`📊 Existing entries in Firestore: ${existingIds.size}\n`);

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const entry of missingEntries) {
      if (existingIds.has(entry.id)) {
        console.log(`⏭️  Skipping ${entry.id} - already exists`);
        skipped++;
        continue;
      }

      try {
        await db.collection(COLLECTION).doc(entry.id).set(entry);
        console.log(`✅ Added: ${entry.title} (${entry.id})`);
        added++;
      } catch (error) {
        console.error(`❌ Error adding ${entry.id}:`, error);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Added: ${added} entries`);
    console.log(`   ⏭️  Skipped: ${skipped} entries (already exist)`);
    console.log(`   ❌ Errors: ${errors} entries`);

    if (added > 0) {
      console.log('\n✨ Missing KB entries have been added successfully!');
      console.log('💡 Remember to sync to Vertex AI Search: npm run sync-kb-to-vertex');
    } else if (skipped === missingEntries.length) {
      console.log('\n✨ All entries already exist in the KB!');
    }

  } catch (error) {
    console.error('❌ Error adding missing entries:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addMissingEntries()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { addMissingEntries };

