// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const { TotoAI } = require('./dist/index.js');
const { SchedulerService } = require('./dist/services/SchedulerService');
const admin = require('firebase-admin');

// Updated to trigger new deployment with fixed secret

// Twitter web scraping (no API credentials needed)
console.log('🔍 Twitter web scraping enabled (no API credentials needed)');

// Initialize Firebase Admin SDK for toto-app-stg and toto-bo
let totoAppStgApp = null;
let totoBoApp = null;
const fs = require('fs');

// Initialize toto-app-stg Firebase Admin
try {
  let serviceAccount = null;
  
  // Try environment variable first (for production)
  const serviceAccountJson = process.env.TOTO_APP_STG_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    serviceAccount = JSON.parse(serviceAccountJson);
    console.log('✅ Using toto-app-stg service account from environment variable');
  } else {
    // Try local file (for development)
    const serviceAccountPath = path.join(__dirname, 'toto-f9d2f-stg-firebase-adminsdk-fbsvc-d4bdd9b852.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(serviceAccountFile);
      console.log('✅ Using local toto-app-stg service account file');
    }
  }
  
  if (serviceAccount) {
    // Check if app already exists
    try {
      totoAppStgApp = admin.app(); // Get default app
      console.log('✅ toto-app-stg Firebase Admin already initialized as default');
    } catch {
      // Initialize as DEFAULT app (no name) so admin.firestore() works
      totoAppStgApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'toto-f9d2f-stg'
      });
      console.log('✅ Firebase Admin SDK initialized for toto-app-stg as DEFAULT app');
    }
  } else {
    console.log('⚠️ No toto-app-stg service account credentials found, skipping connection');
  }
} catch (error) {
  console.error('❌ Failed to initialize toto-app-stg Firebase Admin SDK:', error.message);
}

// Initialize toto-bo Firebase Admin
try {
  let totoBoServiceAccount = null;
  
  // Try environment variable first
  const totoBoServiceAccountJson = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;
  if (totoBoServiceAccountJson) {
    totoBoServiceAccount = JSON.parse(totoBoServiceAccountJson);
    console.log('✅ Using toto-bo service account from environment variable');
  } else {
    // Try to find toto-bo service account file (might not exist locally)
    // Note: This is expected for development - toto-bo credentials may not be available
    console.log('⚠️ TOTO_BO_SERVICE_ACCOUNT_KEY not found in environment variables');
    console.log('   Social media posts will use API calls to toto-bo instead');
  }
  
  if (totoBoServiceAccount) {
    // Check if app already exists
    try {
      totoBoApp = admin.app('toto-bo');
      console.log('✅ toto-bo Firebase Admin already initialized');
    } catch {
      totoBoApp = admin.initializeApp({
        credential: admin.credential.cert(totoBoServiceAccount),
      }, 'toto-bo');
      console.log('✅ Firebase Admin SDK initialized for toto-bo');
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize toto-bo Firebase Admin SDK:', error.message);
  console.log('   Social media posts will use API calls to toto-bo instead');
}

// Helper functions to get Firestore and Storage instances
const getTotoBoFirestore = () => {
  if (totoBoApp) {
    return admin.firestore(totoBoApp);
  }
  // Fallback to default app (toto-app-stg) for local development
  // Both toto-bo and toto-app-stg use the same database in dev
  if (totoAppStgApp) {
    console.log('⚠️ Using toto-app-stg Firestore as fallback for social media posts');
    return admin.firestore(totoAppStgApp);
  }
  return null;
};

const getTotoBoStorage = () => {
  if (totoBoApp) {
    return admin.storage(totoBoApp);
  }
  // Fallback to default app (toto-app-stg) for local development
  if (totoAppStgApp) {
    console.log('⚠️ Using toto-app-stg Storage as fallback for social media images');
    return admin.storage(totoAppStgApp);
  }
  return null;
};

// Make helpers available globally for services
global.getTotoBoFirestore = getTotoBoFirestore;
global.getTotoBoStorage = getTotoBoStorage;

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize TotoAI
const totoAI = new TotoAI();

// Initialize Scheduler Service
const schedulerService = new SchedulerService(totoAI);

// Initialize API Gateway
const { TotoAPIGateway } = require('./dist/gateway/TotoAPIGateway');
const apiGateway = new TotoAPIGateway();

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    agents: totoAI.getAvailableAgents()
  });
});

// Rate limit status endpoint
app.get('/api/twitter/rate-limits', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const rateLimitStatus = twitterAgent.getRateLimitStatus();
    res.json({
      success: true,
      rateLimits: rateLimitStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug Twitter Agent endpoint
app.get('/api/twitter/debug', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const guardians = twitterAgent.getGuardians();
    const rateLimitStatus = twitterAgent.getRateLimitStatus();
    
    res.json({
      success: true,
      guardians: guardians,
      rateLimitStatus: rateLimitStatus,
      guardianCount: guardians.length,
      hasTwitterService: !!twitterAgent.twitterService
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test web scraping endpoint
app.get('/api/twitter/test-scraping', async (req, res) => {
  let browser;
  try {
    const username = req.query.username || 'OMFA_refugio';
    console.log(`Testing Puppeteer scraping for @${username}...`);
    
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    await page.goto(`https://x.com/${username}`, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const result = await page.evaluate((username) => {
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      const tweetTexts = document.querySelectorAll('[data-testid="tweetText"]');
      const allText = document.body.textContent || '';
      
      // Try to extract actual tweet data
      const tweets = [];
      for (let i = 0; i < Math.min(tweetElements.length, 3); i++) {
        const tweet = tweetElements[i];
        const textElement = tweet.querySelector('[data-testid="tweetText"]');
        const timeElement = tweet.querySelector('time');
        const likeElement = tweet.querySelector('[data-testid="like"]');
        const retweetElement = tweet.querySelector('[data-testid="retweet"]');
        const replyElement = tweet.querySelector('[data-testid="reply"]');
        
        if (textElement) {
          const text = textElement.textContent?.trim() || '';
          const time = timeElement?.getAttribute('datetime') || new Date().toISOString();
          const likes = likeElement?.textContent?.trim() || '0';
          const retweets = retweetElement?.textContent?.trim() || '0';
          const replies = replyElement?.textContent?.trim() || '0';
          
          tweets.push({
            id: `scraped_${Date.now()}_${i}`,
            text: text,
            created_at: time,
            public_metrics: {
              like_count: parseInt(likes.replace(/[^\d]/g, '')) || 0,
              retweet_count: parseInt(retweets.replace(/[^\d]/g, '')) || 0,
              reply_count: parseInt(replies.replace(/[^\d]/g, '')) || 0
            },
            author_id: username
          });
        }
      }
      
      return {
        tweetElements: tweetElements.length,
        tweetTexts: tweetTexts.length,
        bodyTextLength: allText.length,
        sampleText: allText.substring(0, 500),
        hasDataTestIdTweet: tweetElements.length > 0,
        hasDataTestIdTweetText: tweetTexts.length > 0,
        pageTitle: document.title,
        url: window.location.href,
        tweets: tweets
      };
    }, username);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Get available agents
app.get('/api/agents', (req, res) => {
  try {
    const agents = totoAI.getAvailableAgents();
    res.json({ success: true, agents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scheduler endpoints
app.get('/api/scheduler/status', (req, res) => {
  try {
    const status = schedulerService.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Unified Social Media Monitoring Endpoint
app.get('/api/social-media/monitor', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Social Media Monitoring endpoint is available. Use POST to trigger monitoring.' 
  });
});

app.post('/api/social-media/monitor', async (req, res) => {
  try {
    const { guardianId } = req.body || {};
    console.log('📡 Received POST request to /api/social-media/monitor', guardianId ? `for guardian: ${guardianId}` : '(all guardians)');

    const results = await schedulerService.triggerSocialMediaMonitoring(guardianId);
    res.json({ success: true, results });
  } catch (error) {
    console.error('❌ Error in /api/social-media/monitor:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

app.post('/api/scheduler/trigger-twitter', async (req, res) => {
  try {
    const results = await schedulerService.triggerTwitterAgentMonitoring();
    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Twitter agent monitoring stats
app.get('/api/twitter/stats', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const stats = twitterAgent.getMonitoringStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get review queue status
app.get('/api/twitter/review-queue', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const reviewStatus = twitterAgent.getReviewQueueStatus();
    res.json({ success: true, reviewStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get detailed review queue items (for dashboard)
app.get('/api/twitter/review-queue/items', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { status, type, urgency, limit = 50, offset = 0 } = req.query;
    
    // Get review queue items with filtering
    const allItems = twitterAgent.getReviewQueueItems();
    
    let filteredItems = allItems;
    
    // Apply filters
    if (status) {
      filteredItems = filteredItems.filter(item => item.status === status);
    }
    if (type) {
      filteredItems = filteredItems.filter(item => item.type === type);
    }
    if (urgency) {
      filteredItems = filteredItems.filter(item => item.urgency === urgency);
    }
    
    // Apply pagination
    const paginatedItems = filteredItems.slice(offset, offset + limit);
    
    res.json({ 
      success: true, 
      items: paginatedItems,
      total: filteredItems.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific review item details
app.get('/api/twitter/review-queue/items/:itemId', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { itemId } = req.params;
    
    const item = twitterAgent.getReviewItem(itemId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Review item not found' });
    }
    
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve a review item
app.post('/api/twitter/review-queue/items/:itemId/approve', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { itemId } = req.params;
    const { notes, reviewedBy } = req.body;
    
    const result = await twitterAgent.approveReviewItem(itemId, { notes, reviewedBy });
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject a review item
app.post('/api/twitter/review-queue/items/:itemId/reject', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { itemId } = req.params;
    const { notes, reviewedBy, reason } = req.body;
    
    const result = await twitterAgent.rejectReviewItem(itemId, { notes, reviewedBy, reason });
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Twitter agent configuration
app.get('/api/twitter/config', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const config = twitterAgent.getConfiguration();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Twitter agent configuration
app.put('/api/twitter/config', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { config } = req.body;
    
    const result = twitterAgent.updateConfiguration(config);
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Twitter agent analytics/history
app.get('/api/twitter/analytics', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { days = 7, type = 'all' } = req.query;
    
    const analytics = twitterAgent.getAnalytics(parseInt(days), type);
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get guardian monitoring status
app.get('/api/twitter/guardians', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    let guardians = twitterAgent.getGuardians();
    
    // Always try to fetch from toto-bo database first
    try {
      const db = admin.firestore();
      // Fetch users with guardian role
      const guardiansSnapshot = await db.collection('users')
        .where('role', '==', 'guardian')
        .orderBy('createdAt', 'desc')
        .get();
      
      const dbGuardians = guardiansSnapshot.docs.map(doc => {
        const userData = doc.data();
        console.log(`Debug: Guardian ${userData.name} - contactInfo:`, JSON.stringify(userData.contactInfo, null, 2));
        const twitterHandle = userData.contactInfo?.socialLinks?.twitter || 'unknown';
        const twitterUserId = twitterHandle !== 'unknown' ? `twitter_${twitterHandle}` : ''; // Generate a placeholder Twitter user ID
        
        return {
          id: doc.id,
          name: userData.name || 'Unknown Guardian',
          twitterHandle: twitterHandle,
          twitterUserId: twitterUserId,
          isActive: userData.status === 'active',
          lastTweetFetch: null, // Will be set when we actually fetch tweets
          createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
          updatedAt: userData.updatedAt ? new Date(userData.updatedAt) : new Date()
        };
      });
      
      // Update the Twitter Agent with the fetched guardians
      if (dbGuardians.length > 0) {
        // Initialize with empty credentials (web scraping only)
        const mockCredentials = {};
        await twitterAgent.initialize(mockCredentials, dbGuardians);
        guardians = twitterAgent.getGuardians();
      } else {
        // If no guardians in database, create some mock guardians for testing
        const mockGuardians = [
          {
            id: 'guardian_1',
            name: 'Maria Fernandez',
            twitterHandle: 'maria_fernandez',
            twitterUserId: '123456789',
            isActive: true,
            lastTweetFetch: null,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'guardian_2',
            name: 'Carlos Rodriguez',
            twitterHandle: 'carlos_rescue',
            twitterUserId: '987654321',
            isActive: true,
            lastTweetFetch: null,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'guardian_3',
            name: 'Ana Martinez',
            twitterHandle: 'ana_animal_rescue',
            twitterUserId: '456789123',
            isActive: false,
            lastTweetFetch: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        
        const mockCredentials = {};
        await twitterAgent.initialize(mockCredentials, mockGuardians);
        guardians = twitterAgent.getGuardians();
      }
    } catch (dbError) {
      console.warn('Could not fetch guardians from database:', dbError.message);
      // If database fetch fails, use mock guardians
      const mockGuardians = [
        {
          id: 'guardian_1',
          name: 'Maria Fernandez',
          twitterHandle: 'maria_fernandez',
          twitterUserId: '123456789',
          isActive: true,
          lastTweetFetch: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'guardian_2',
          name: 'Carlos Rodriguez',
          twitterHandle: 'carlos_rescue',
          twitterUserId: '987654321',
          isActive: true,
          lastTweetFetch: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      const mockCredentials = {};
      await twitterAgent.initialize(mockCredentials, mockGuardians);
      guardians = twitterAgent.getGuardians();
    }
    
    res.json({ success: true, guardians });
  } catch (error) {
    console.error('Error fetching guardians:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update guardian monitoring status
app.put('/api/twitter/guardians/:guardianId', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { guardianId } = req.params;
    const { isActive, ...updates } = req.body;
    
    const result = twitterAgent.updateGuardian(guardianId, { isActive, ...updates });
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run Twitter monitoring cycle
app.post('/api/twitter/monitor', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    
    // TODO: Initialize with real Twitter credentials and guardians
    // Use empty credentials for web scraping
    const mockCredentials = {};
    
    const mockGuardians = [
      {
        id: 'guardian_1',
        name: 'Maria Fernandez',
        twitterHandle: 'maria_fernandez',
        twitterUserId: '123456789',
        isActive: true,
        lastTweetFetch: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    await twitterAgent.initialize(mockCredentials, mockGuardians);
    const result = await twitterAgent.runMonitoringCycle();
    
    res.json(result);
  } catch (error) {
    console.error('Error running Twitter monitoring:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get recent tweets from guardians
app.get('/api/twitter/tweets', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { guardianId, limit = 20, hours = 24 } = req.query;
    
    const tweets = await twitterAgent.getRecentTweets(guardianId, parseInt(limit), parseInt(hours));
    res.json({ success: true, tweets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Twitter connection
app.post('/api/twitter/test-connection', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { credentials } = req.body;
    
    // No credentials needed for web scraping
    const finalCredentials = {};
    
    const result = await twitterAgent.testConnection(finalCredentials);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simulate tweet fetching for testing
app.post('/api/twitter/simulate-fetch', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { guardianId, limit = 5 } = req.body;
    
    if (!guardianId) {
      return res.status(400).json({ success: false, error: 'guardianId is required' });
    }
    
    const result = await twitterAgent.simulateTweetFetching(guardianId, limit);
    res.json(result);
  } catch (error) {
    console.error('Error simulating tweet fetch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch real tweets for testing
app.post('/api/twitter/fetch-real-tweets', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const { guardianId, limit = 5, credentials } = req.body;
    
    if (!guardianId) {
      return res.status(400).json({ success: false, error: 'guardianId is required' });
    }

    // No credentials needed for web scraping
    const finalCredentials = {};
    
    // Get the actual guardian data from the Twitter Agent
    let existingGuardians = twitterAgent.getGuardians();
    console.log('Debug: Available guardians:', existingGuardians.map(g => ({ id: g.id, name: g.name })));
    console.log('Debug: Looking for guardian ID:', guardianId);
    
    // If no guardians loaded, load them from database
    if (existingGuardians.length === 0) {
      console.log('Debug: No guardians loaded, fetching from database...');
      try {
        const db = admin.firestore();
        const guardiansSnapshot = await db.collection('users')
          .where('role', '==', 'guardian')
          .orderBy('createdAt', 'desc')
          .get();
        
        const dbGuardians = guardiansSnapshot.docs.map(doc => {
          const userData = doc.data();
          const twitterHandle = userData.contactInfo?.socialLinks?.twitter || 'unknown';
          const twitterUserId = twitterHandle !== 'unknown' ? `twitter_${twitterHandle}` : '';
          
          return {
            id: doc.id,
            name: userData.name || 'Unknown Guardian',
            twitterHandle: twitterHandle,
            twitterUserId: twitterUserId,
            isActive: userData.status === 'active',
            lastTweetFetch: null,
            createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
            updatedAt: userData.updatedAt ? new Date(userData.updatedAt) : new Date()
          };
        });
        
        if (dbGuardians.length > 0) {
          const mockCredentials = {};
          await twitterAgent.initialize(mockCredentials, dbGuardians);
          existingGuardians = twitterAgent.getGuardians();
          console.log('Debug: Loaded guardians from database:', existingGuardians.map(g => ({ id: g.id, name: g.name })));
        }
      } catch (dbError) {
        console.warn('Could not fetch guardians from database:', dbError.message);
      }
    }
    
    const guardian = existingGuardians.find(g => g.id === guardianId);
    
    if (!guardian) {
      console.log('Debug: Guardian not found in list');
      return res.status(400).json({ success: false, error: 'Guardian not found' });
    }
    
    console.log('Debug: Found guardian:', { id: guardian.id, name: guardian.name });
    
    // Re-initialize with all existing guardians and new credentials
    await twitterAgent.initialize(finalCredentials, existingGuardians);
    
    const result = await twitterAgent.fetchRealTweets(guardianId, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching real tweets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// INSTAGRAM AGENT ENDPOINTS
// ============================================================

// Get Instagram agent configuration
app.get('/api/instagram/config', (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const config = instagramAgent.getConfiguration();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Instagram agent configuration
app.put('/api/instagram/config', (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const { config } = req.body;
    
    const result = instagramAgent.updateConfiguration(config);
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Instagram agent analytics/history
app.get('/api/instagram/analytics', (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const stats = instagramAgent.getMonitoringStats();
    res.json({ success: true, analytics: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get guardian monitoring status
app.get('/api/instagram/guardians', async (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    let guardians = instagramAgent.getGuardians();
    
    // Always try to fetch from toto-bo database first
    try {
      const db = admin.firestore();
      // Fetch users with guardian role
      const guardiansSnapshot = await db.collection('users')
        .where('role', '==', 'guardian')
        .orderBy('createdAt', 'desc')
        .get();
      
      const dbGuardians = guardiansSnapshot.docs.map(doc => {
        const userData = doc.data();
        const instagramHandle = userData.contactInfo?.socialLinks?.instagram || 'unknown';
        // Clean up Instagram handle (remove @, URLs, etc.)
        const cleanHandle = instagramHandle
          .replace('@', '')
          .replace('https://instagram.com/', '')
          .replace('https://www.instagram.com/', '')
          .replace('instagram.com/', '')
          .replace(/\/$/, '');
        
        return {
          id: doc.id,
          name: userData.name || 'Unknown Guardian',
          instagramHandle: cleanHandle !== 'unknown' ? cleanHandle : '',
          instagramUserId: userData.instagramUserId,
          accessToken: userData.instagramAccessToken,
          isActive: userData.status === 'active',
          lastPostFetch: null,
          createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
          updatedAt: userData.updatedAt ? new Date(userData.updatedAt) : new Date()
        };
      }).filter(g => g.instagramHandle); // Only include guardians with Instagram handles
      
      // Update the Instagram Agent with the fetched guardians
      if (dbGuardians.length > 0) {
        // Initialize with empty credentials (web scraping or API if tokens available)
        const credentials = {};
        await instagramAgent.initialize(credentials, dbGuardians);
        guardians = instagramAgent.getGuardians();
      } else {
        // If no guardians in database, create some mock guardians for testing
        const mockGuardians = [
          {
            id: 'guardian_1',
            name: 'Maria Fernandez',
            instagramHandle: 'maria_fernandez',
            instagramUserId: undefined,
            accessToken: undefined,
            isActive: true,
            lastPostFetch: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        
        const credentials = {};
        await instagramAgent.initialize(credentials, mockGuardians);
        guardians = instagramAgent.getGuardians();
      }
    } catch (dbError) {
      console.warn('Could not fetch guardians from database:', dbError.message);
      // If database fetch fails, use mock guardians
      const mockGuardians = [
        {
          id: 'guardian_1',
          name: 'Maria Fernandez',
          instagramHandle: 'maria_fernandez',
          instagramUserId: undefined,
          accessToken: undefined,
          isActive: true,
          lastPostFetch: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      const credentials = {};
      await instagramAgent.initialize(credentials, mockGuardians);
      guardians = instagramAgent.getGuardians();
    }
    
    res.json({ success: true, guardians });
  } catch (error) {
    console.error('Error fetching guardians:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update guardian monitoring status
app.put('/api/instagram/guardians/:guardianId', (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const { guardianId } = req.params;
    const { isActive, ...updates } = req.body;
    
    const result = instagramAgent.updateGuardian(guardianId, { isActive, ...updates });
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run Instagram monitoring cycle
app.post('/api/instagram/monitor', async (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    
    // Initialize with credentials (empty for web scraping, or from request body)
    const { credentials = {} } = req.body;
    
    // Load guardians from database or use provided ones
    let guardians = instagramAgent.getGuardians();
    if (guardians.length === 0) {
      try {
        const db = admin.firestore();
        const guardiansSnapshot = await db.collection('users')
          .where('role', '==', 'guardian')
          .get();
        
        guardians = guardiansSnapshot.docs.map(doc => {
          const userData = doc.data();
          const instagramHandle = userData.contactInfo?.socialLinks?.instagram || '';
          const cleanHandle = instagramHandle
            .replace('@', '')
            .replace('https://instagram.com/', '')
            .replace('https://www.instagram.com/', '')
            .replace('instagram.com/', '')
            .replace(/\/$/, '');
          
          return {
            id: doc.id,
            name: userData.name || 'Unknown Guardian',
            instagramHandle: cleanHandle,
            instagramUserId: userData.instagramUserId,
            accessToken: userData.instagramAccessToken,
            isActive: userData.status === 'active',
            lastPostFetch: null,
            createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
            updatedAt: userData.updatedAt ? new Date(userData.updatedAt) : new Date()
          };
        }).filter(g => g.instagramHandle);
      } catch (dbError) {
        console.warn('Could not load guardians from database:', dbError.message);
      }
    }
    
    if (guardians.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No guardians with Instagram accounts found' 
      });
    }
    
    await instagramAgent.initialize(credentials, guardians);
    const result = await instagramAgent.runMonitoringCycle();
    
    res.json(result);
  } catch (error) {
    console.error('Error running Instagram monitoring:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get review queue status
app.get('/api/instagram/review-queue', (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const reviewStatus = instagramAgent.getReviewQueueStatus();
    res.json({ success: true, reviewStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get detailed review queue items (for dashboard)
app.get('/api/instagram/review-queue/items', (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const { status, type, urgency, limit } = req.query;
    
    // Get review queue items with filtering
    const allItems = instagramAgent.getReviewQueueItems();
    
    let filteredItems = allItems;
    
    if (status) {
      filteredItems = filteredItems.filter(item => item.status === status);
    }
    if (type) {
      filteredItems = filteredItems.filter(item => item.type === type);
    }
    if (urgency) {
      filteredItems = filteredItems.filter(item => item.urgency === urgency);
    }
    
    // Sort by creation date (newest first)
    filteredItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Apply limit if provided
    const limitNum = limit ? parseInt(limit) : undefined;
    if (limitNum) {
      filteredItems = filteredItems.slice(0, limitNum);
    }
    
    res.json({ success: true, items: filteredItems, total: allItems.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific review item details
app.get('/api/instagram/review-queue/items/:itemId', (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const { itemId } = req.params;
    const item = instagramAgent.getReviewItem(itemId);
    
    if (!item) {
      return res.status(404).json({ success: false, error: 'Review item not found' });
    }
    
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve a review item
app.post('/api/instagram/review-queue/items/:itemId/approve', async (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const { itemId } = req.params;
    const { notes, reviewedBy } = req.body;
    
    const result = await instagramAgent.approveReviewItem(itemId, { notes, reviewedBy });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject a review item
app.post('/api/instagram/review-queue/items/:itemId/reject', async (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const { itemId } = req.params;
    const { notes, reviewedBy, reason } = req.body;
    
    const result = await instagramAgent.rejectReviewItem(itemId, { notes, reviewedBy, reason });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Instagram connection
app.post('/api/instagram/test-connection', async (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const { credentials = {} } = req.body;
    
    const result = await instagramAgent.testConnection(credentials);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get monitoring statistics
app.get('/api/instagram/stats', (req, res) => {
  try {
    const instagramAgent = totoAI.getInstagramAgent();
    const stats = instagramAgent.getMonitoringStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cases from toto-app-stg
app.get('/api/cases', async (req, res) => {
  try {
    const db = admin.firestore();
    const casesSnapshot = await db.collection('cases')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    const cases = [];
    
    // Process cases and fetch guardian information
    for (const doc of casesSnapshot.docs) {
      const caseData = doc.data();
      
      // Fetch guardian information if guardianId exists
      let guardianInfo = {};
      if (caseData.guardianId) {
        try {
          const guardianDoc = await db.collection('users').doc(caseData.guardianId).get();
          if (guardianDoc.exists) {
            const guardianData = guardianDoc.data();
            guardianInfo = {
              guardianBankingAlias: guardianData.bankingAccountAlias,
              guardianTwitter: guardianData.contactInfo?.socialLinks?.twitter,
              guardianInstagram: guardianData.contactInfo?.socialLinks?.instagram
            };
          }
        } catch (guardianError) {
          console.warn(`Could not fetch guardian info for case ${doc.id}:`, guardianError.message);
        }
      }
      
      cases.push({
        id: doc.id,
        name: caseData.name || 'Unnamed Case',
        description: caseData.description || 'No description available',
        status: caseData.status || 'unknown',
        animalType: caseData.animalType || 'Unknown',
        location: caseData.location || 'Unknown location',
        guardianName: caseData.guardianName || 'Unknown guardian',
        targetAmount: caseData.targetAmount || 0,
        currentAmount: caseData.currentAmount || 0,
        createdAt: caseData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: caseData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        ...guardianInfo
      });
    }
    
    res.json({ success: true, cases });
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process case message
app.post('/api/case', async (req, res) => {
  try {
    const { message, caseData, userContext, conversationContext } = req.body;
    
    if (!message || !caseData || !userContext) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: message, caseData, userContext' 
      });
    }

    const response = await totoAI.processCaseMessage(
      message,
      caseData,
      userContext,
      conversationContext
    );

    res.json(response);
  } catch (error) {
    console.error('Error processing case message:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===== AI API GATEWAY ENDPOINTS =====
// These endpoints are used by toto-bo AI Hub dashboard

// Get analytics data
app.get('/api/ai/insights', async (req, res) => {
  try {
    const analytics = await apiGateway.getAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced analytics endpoint
app.get('/api/ai/analytics', async (req, res) => {
  try {
    const { timeRange = '7d', agentType = 'case-agent', includeDetails = false } = req.query;
    
    // Get analytics from the enhanced Case Agent
    const caseAgent = totoAI.getCaseAgent();
    const analytics = caseAgent.getAnalytics();
    
    // Add additional computed metrics
    const enhancedAnalytics = {
      ...analytics,
      metadata: {
        timeRange,
        agentType,
        includeDetails,
        timestamp: new Date().toISOString(),
        source: 'toto-ai-hub'
      },
      computed: {
        successRate: analytics.totalInteractions > 0 ? 
          (analytics.successfulInteractions / analytics.totalInteractions * 100).toFixed(2) : 0,
        averageResponseTimeFormatted: `${analytics.averageResponseTime}ms`,
        userEngagementScore: calculateEngagementScore(analytics.userEngagementDistribution),
        topActionCategory: analytics.topActions?.[0]?.action || 'none'
      }
    };
    
    res.json(enhancedAnalytics);
  } catch (error) {
    console.error('Error fetching enhanced analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Analytics feedback endpoint
app.post('/api/ai/analytics/feedback', async (req, res) => {
  try {
    const { sessionId, userId, action, satisfaction, feedback, metadata } = req.body;
    
    if (!sessionId || !userId || !action) {
      return res.status(400).json({
        error: 'sessionId, userId, and action are required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Store feedback (in a real implementation, this would be stored in a database)
    console.log('📊 Analytics feedback received:', {
      sessionId,
      userId,
      action,
      satisfaction,
      feedback,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Feedback recorded successfully',
      metadata: {
        sessionId,
        userId,
        action,
        satisfaction,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error processing analytics feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get available agents
app.get('/api/ai/agents', async (req, res) => {
  try {
    const agents = await apiGateway.getAgents();
    res.json(agents);
  } catch (error) {
    console.error('Error fetching AI agents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get knowledge base
app.get('/api/ai/knowledge', async (req, res) => {
  try {
    const knowledge = await apiGateway.getKnowledgeBase();
    res.json(knowledge);
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add knowledge item
app.post('/api/ai/knowledge', async (req, res) => {
  try {
    const { title, content, category, agentTypes, audience } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const newItem = await apiGateway.addKnowledgeItem(title, content, category, agentTypes || [], audience || []);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating knowledge item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset knowledge base
app.post('/api/ai/knowledge/reset', async (req, res) => {
  try {
    await apiGateway.resetKnowledgeBase();
    res.json({
      success: true,
      message: 'Knowledge base reset successfully',
      resetAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resetting knowledge base:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Retrieve knowledge using RAG
app.post('/api/ai/knowledge/retrieve', async (req, res) => {
  try {
    const { query, agentType, context } = req.body;
    
    if (!query || !agentType) {
      return res.status(400).json({ error: 'Query and agentType are required' });
    }

    const result = await apiGateway.retrieveKnowledge(query, agentType, context);
    res.json(result);
  } catch (error) {
    console.error('Error retrieving knowledge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get RAG memory statistics
app.get('/api/ai/knowledge/memory', async (req, res) => {
  try {
    const ragService = apiGateway.getRAGService();
    const memoryStats = ragService.getMemoryStats();
    
    res.json({
      success: true,
      memory: memoryStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting memory stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Force memory cleanup
app.post('/api/ai/knowledge/cleanup', async (req, res) => {
  try {
    const ragService = apiGateway.getRAGService();
    ragService.forceCleanup();
    
    const memoryStats = ragService.getMemoryStats();
    
    res.json({
      success: true,
      message: 'Memory cleanup completed',
      memory: memoryStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cleaning up memory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test AI system
app.post('/api/ai/test', async (req, res) => {
  try {
    const { message, agent, caseId, twitterHandle } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const testResponse = await apiGateway.testAI(message, agent, caseId, twitterHandle);
    res.json(testResponse);
  } catch (error) {
    console.error('Error testing AI system:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Train agent
app.post('/api/ai/train/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    const trainingResult = await apiGateway.trainAgent(agentId);
    res.json(trainingResult);
  } catch (error) {
    console.error('Error training agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Session management endpoints
app.get('/api/ai/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { includeHistory = false, includeAnalytics = false } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Get session data from Case Agent
    const caseAgent = totoAI.getCaseAgent();
    const sessionData = caseAgent.getConversationMemory(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Enhance session data
    const enhancedSessionData = {
      ...sessionData,
      metadata: {
        sessionId,
        includeHistory,
        includeAnalytics,
        timestamp: new Date().toISOString(),
        source: 'toto-ai-hub'
      },
      computed: {
        sessionDuration: sessionData.lastInteraction && sessionData.createdAt ? 
          new Date(sessionData.lastInteraction).getTime() - new Date(sessionData.createdAt).getTime() : 0,
        messageCount: sessionData.conversationHistory?.length || 0,
        averageMessageLength: calculateAverageMessageLength(sessionData.conversationHistory),
        userEngagementLevel: determineEngagementLevel(sessionData.conversationHistory),
        sessionStatus: determineSessionStatus(sessionData.lastInteraction)
      }
    };
    
    res.json(enhancedSessionData);
  } catch (error) {
    console.error('Error fetching session data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

app.put('/api/ai/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updateData = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Update session data (in a real implementation, this would update the database)
    console.log('📝 Session update received:', {
      sessionId,
      updateData,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Session updated successfully',
      metadata: {
        sessionId,
        timestamp: new Date().toISOString(),
        source: 'toto-ai-hub'
      }
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

app.delete('/api/ai/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { archive = false } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Delete/archive session (in a real implementation, this would update the database)
    console.log('🗑️ Session deletion requested:', {
      sessionId,
      archive,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: archive ? 'Session archived successfully' : 'Session deleted successfully',
      metadata: {
        sessionId,
        archive,
        timestamp: new Date().toISOString(),
        source: 'toto-ai-hub'
      }
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// User profile management endpoints
app.get('/api/ai/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { includeHistory = false, includeAnalytics = false } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user profile from Case Agent
    const caseAgent = totoAI.getCaseAgent();
    const profileData = caseAgent.getUserProfile(userId);
    
    if (!profileData) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    
    // Enhance profile data
    const enhancedProfileData = {
      ...profileData,
      metadata: {
        userId,
        includeHistory,
        includeAnalytics,
        timestamp: new Date().toISOString(),
        source: 'toto-ai-hub'
      },
      insights: {
        totalInteractions: profileData.interactionHistory?.length || 0,
        favoriteAnimalTypes: getFavoriteAnimalTypes(profileData.interactionHistory),
        preferredActions: getPreferredActions(profileData.interactionHistory),
        averageSatisfaction: calculateAverageSatisfaction(profileData.interactionHistory),
        engagementTrend: calculateEngagementTrend(profileData.interactionHistory),
        lastActiveDays: calculateDaysSinceLastActive(profileData.lastActive),
        profileCompleteness: calculateProfileCompleteness(profileData)
      }
    };
    
    res.json(enhancedProfileData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

app.put('/api/ai/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Update user profile (in a real implementation, this would update the database)
    console.log('👤 Profile update received:', {
      userId,
      updateData,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      metadata: {
        userId,
        timestamp: new Date().toISOString(),
        source: 'toto-ai-hub'
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/ai/profile/:userId/interaction', async (req, res) => {
  try {
    const { userId } = req.params;
    const { caseId, actions, satisfaction, feedback, sessionId } = req.body;
    
    if (!userId || !caseId) {
      return res.status(400).json({
        error: 'User ID and case ID are required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Add interaction to user profile (in a real implementation, this would update the database)
    console.log('📊 Profile interaction received:', {
      userId,
      caseId,
      actions,
      satisfaction,
      feedback,
      sessionId,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Interaction recorded successfully',
      metadata: {
        userId,
        caseId,
        sessionId,
        timestamp: new Date().toISOString(),
        source: 'toto-ai-hub'
      }
    });
  } catch (error) {
    console.error('Error adding interaction to user profile:', error);
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions for analytics and session management
function calculateEngagementScore(engagementDistribution) {
  const total = engagementDistribution.low + engagementDistribution.medium + engagementDistribution.high;
  if (total === 0) return 0;
  
  const score = (
    (engagementDistribution.low * 1) + 
    (engagementDistribution.medium * 2) + 
    (engagementDistribution.high * 3)
  ) / total;
  
  return Math.round(score * 100) / 100;
}

function calculateAverageMessageLength(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) return 0;
  
  const totalLength = conversationHistory.reduce((sum, msg) => sum + (msg.message?.length || 0), 0);
  return Math.round(totalLength / conversationHistory.length);
}

function determineEngagementLevel(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) return 'low';
  
  const messageCount = conversationHistory.length;
  const avgLength = calculateAverageMessageLength(conversationHistory);
  
  if (messageCount >= 10 && avgLength >= 50) return 'high';
  if (messageCount >= 5 && avgLength >= 25) return 'medium';
  return 'low';
}

function determineSessionStatus(lastInteraction) {
  if (!lastInteraction) return 'ended';
  
  const lastInteractionTime = new Date(lastInteraction).getTime();
  const now = Date.now();
  const timeDiff = now - lastInteractionTime;
  
  // Consider session active if last interaction was within 30 minutes
  if (timeDiff < 30 * 60 * 1000) return 'active';
  // Consider session idle if last interaction was within 2 hours
  if (timeDiff < 2 * 60 * 60 * 1000) return 'idle';
  return 'ended';
}

function getFavoriteAnimalTypes(interactionHistory) {
  if (!interactionHistory || interactionHistory.length === 0) return [];
  
  const animalTypeCounts = new Map();
  
  interactionHistory.forEach(interaction => {
    // This would need to be enhanced to extract animal types from case data
    // For now, return empty array
  });
  
  return Array.from(animalTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);
}

function getPreferredActions(interactionHistory) {
  if (!interactionHistory || interactionHistory.length === 0) return [];
  
  const actionCounts = new Map();
  
  interactionHistory.forEach(interaction => {
    if (interaction.actions) {
      interaction.actions.forEach((action) => {
        actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      });
    }
  });
  
  return Array.from(actionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([action]) => action);
}

function calculateAverageSatisfaction(interactionHistory) {
  if (!interactionHistory || interactionHistory.length === 0) return 0;
  
  const totalSatisfaction = interactionHistory.reduce((sum, interaction) => 
    sum + (interaction.satisfaction || 0), 0);
  
  return Math.round((totalSatisfaction / interactionHistory.length) * 100) / 100;
}

function calculateEngagementTrend(interactionHistory) {
  if (!interactionHistory || interactionHistory.length < 2) return 'stable';
  
  const recent = interactionHistory.slice(-5);
  const older = interactionHistory.slice(-10, -5);
  
  const recentAvg = recent.reduce((sum, i) => sum + (i.satisfaction || 0), 0) / recent.length;
  const olderAvg = older.length > 0 ? 
    older.reduce((sum, i) => sum + (i.satisfaction || 0), 0) / older.length : recentAvg;
  
  if (recentAvg > olderAvg + 0.1) return 'increasing';
  if (recentAvg < olderAvg - 0.1) return 'decreasing';
  return 'stable';
}

function calculateDaysSinceLastActive(lastActive) {
  if (!lastActive) return 0;
  
  const lastActiveTime = new Date(lastActive).getTime();
  const now = Date.now();
  const timeDiff = now - lastActiveTime;
  
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
}

function calculateProfileCompleteness(profileData) {
  let completeness = 0;
  const maxScore = 10;
  
  if (profileData.userId) completeness += 1;
  if (profileData.preferences?.language) completeness += 1;
  if (profileData.preferences?.communicationStyle) completeness += 1;
  if (profileData.preferences?.animalTypes?.length > 0) completeness += 1;
  if (profileData.preferences?.actionTypes?.length > 0) completeness += 1;
  if (profileData.engagementLevel) completeness += 1;
  if (profileData.lastActive) completeness += 1;
  if (profileData.interactionHistory?.length > 0) completeness += 1;
  if (profileData.insights) completeness += 1;
  if (profileData.metadata) completeness += 1;
  
  return Math.round((completeness / maxScore) * 100);
}

// Check agent configuration
app.get('/api/check-agent-config', async (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const config = {
      reviewQueueEnabled: twitterAgent.config?.reviewPolicy?.reviewQueueEnabled,
      requireManualReview: twitterAgent.config?.reviewPolicy?.requireManualReview,
      autoApproveThreshold: twitterAgent.config?.reviewPolicy?.autoApproveThreshold,
      guardiansCount: twitterAgent.getGuardians()?.length,
      guardians: twitterAgent.getGuardians()?.map(g => ({ id: g.id, name: g.name, twitterHandle: g.twitterHandle }))
    };
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Direct test to save a post to Firestore
app.post('/api/direct-save-test', async (req, res) => {
  try {
    console.log('🧪 Direct Firestore save test...');
    
    const { SocialMediaPostService } = require('./dist/services/SocialMediaPostService.js');
    const service = new SocialMediaPostService();
    
    const testPost = {
      platform: 'twitter',
      guardianId: 'test_guardian_' + Date.now(),
      guardianName: 'Test Guardian',
      postId: 'direct_test_' + Date.now(),
      postContent: 'This is a direct test post',
      postUrl: 'https://twitter.com/test',
      images: [],
      imageFileNames: [],
      recommendedAction: 'dismiss',
      status: 'pending',
      urgency: 'low',
      confidence: 0.9,
      metadata: {}
    };
    
    console.log('📝 Attempting to save post directly:', testPost.postId);
    const savedId = await service.savePost(testPost);
    
    if (savedId) {
      console.log('✅ Post saved successfully:', savedId);
      res.json({ success: true, savedId, message: 'Post saved successfully' });
    } else {
      console.error('❌ savePost returned null');
      res.json({ success: false, message: 'savePost returned null' });
    }
    
  } catch (error) {
    console.error('❌ Direct save test failed:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

// Debug endpoint to check agent configuration
app.get('/api/debug/agent-config', (req, res) => {
  try {
    const twitterAgent = totoAI.getTwitterAgent();
    const instagramAgent = totoAI.getInstagramAgent();
    
    const config = {
      twitter: {
        guardiansCount: twitterAgent.getGuardians()?.length || 0,
        guardians: twitterAgent.getGuardians()?.map(g => ({
          id: g.id,
          name: g.name,
          twitterHandle: g.twitterHandle
        })) || [],
        reviewQueueEnabled: twitterAgent.config?.reviewPolicy?.reviewQueueEnabled,
        requireManualReview: twitterAgent.config?.reviewPolicy?.requireManualReview,
        autoApproveThreshold: twitterAgent.config?.reviewPolicy?.autoApproveThreshold
      },
      instagram: {
        guardiansCount: instagramAgent.getGuardians()?.length || 0,
        guardians: instagramAgent.getGuardians()?.map(g => ({
          id: g.id,
          name: g.name,
          instagramHandle: g.instagramHandle
        })) || [],
        reviewQueueEnabled: instagramAgent.config?.reviewPolicy?.reviewQueueEnabled
      }
    };
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to manually trigger Twitter analysis (for debugging)
app.post('/api/test-twitter-analysis', async (req, res) => {
  try {
    console.log('🧪 Testing Twitter analysis and save flow...');
    
    const twitterAgent = totoAI.getTwitterAgent();
    
    // Check config
    console.log('Config reviewQueueEnabled:', twitterAgent.config?.reviewPolicy?.reviewQueueEnabled);
    console.log('Config guardians count:', twitterAgent.getGuardians()?.length);
    
    // Create a test tweet
    const testTweet = {
      id: 'test_' + Date.now(),
      content: 'Test tweet for debugging - rescued puppy doing well',
      author: {
        name: 'Test Guardian',
        handle: 'testguardian',
        profileImageUrl: ''
      },
      metrics: { likes: 0, retweets: 0, replies: 0 },
      media: { images: [], videos: [] },
      createdAt: new Date(),
      fetchedAt: new Date()
    };
    
    console.log('🔍 Calling analyzeTweetsAndCreateUpdates...');
    const result = await twitterAgent.analyzeTweetsAndCreateUpdates([testTweet]);
    
    console.log('📊 Analysis result:', JSON.stringify(result, null, 2));
    
    res.json({
      success: true,
      message: 'Test completed - check console for detailed logs',
      result
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Test endpoint to diagnose Firestore save issues
app.post('/api/test-save', async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    // Test 1: Check if getTotoBoFirestore is available
    const getTotoBoFirestoreFunc = global.getTotoBoFirestore;
    diagnostics.tests.push({
      test: 'getTotoBoFirestore function exists',
      passed: typeof getTotoBoFirestoreFunc === 'function',
      result: typeof getTotoBoFirestoreFunc
    });

    // Test 2: Try to get Firestore instance
    let db = null;
    if (getTotoBoFirestoreFunc) {
      db = getTotoBoFirestoreFunc();
      diagnostics.tests.push({
        test: 'getTotoBoFirestore returns instance',
        passed: db !== null,
        result: db ? 'Firestore instance obtained' : 'null returned'
      });
    }

    // Test 3: Try to save a test document
    if (db) {
      const testPostId = `test_${Date.now()}`;
      const testDoc = {
        platform: 'twitter',
        guardianId: 'test_guardian',
        guardianName: 'Test Guardian',
        postId: testPostId,
        postContent: 'Test post for diagnostics',
        postUrl: 'https://test.com',
        images: [],
        imageFileNames: [],
        recommendedAction: 'dismiss',
        status: 'pending',
        urgency: 'low',
        confidence: 0.9,
        metadata: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = db.collection('socialMediaPosts').doc(testPostId);
      await docRef.set(testDoc);
      
      diagnostics.tests.push({
        test: 'Save test document to Firestore',
        passed: true,
        result: `Saved with ID: ${testPostId}`
      });

      // Test 4: Try to read it back
      const readDoc = await docRef.get();
      diagnostics.tests.push({
        test: 'Read test document back',
        passed: readDoc.exists,
        result: readDoc.exists ? 'Document found' : 'Document not found'
      });

      // Clean up
      await docRef.delete();
      diagnostics.tests.push({
        test: 'Delete test document',
        passed: true,
        result: 'Cleaned up test data'
      });
    }

    diagnostics.summary = {
      allPassed: diagnostics.tests.every(t => t.passed),
      totalTests: diagnostics.tests.length,
      passedTests: diagnostics.tests.filter(t => t.passed).length
    };

    res.json(diagnostics);

  } catch (error) {
    diagnostics.error = {
      message: error.message,
      stack: error.stack
    };
    diagnostics.summary = {
      allPassed: false,
      error: 'Exception occurred during testing'
    };
    res.status(500).json(diagnostics);
  }
});

// Start server
app.listen(port, () => {
  console.log(`TotoAI server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Available agents: http://localhost:${port}/api/agents`);
  
  // Start the scheduler
  schedulerService.startAll();
});
