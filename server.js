// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const { TotoAI } = require('./dist/index.js');
const { SchedulerService } = require('./dist/services/SchedulerService');
const admin = require('firebase-admin');

// Updated to trigger new deployment with fixed secret

// Load Twitter API credentials from environment variables (same as toto-bo)
const TWITTER_CREDENTIALS = {
  apiKey: process.env.TWITTER_API_KEY || '',
  apiSecret: process.env.TWITTER_API_SECRET || '',
  accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
  accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || ''
};

console.log('🔑 Twitter API credentials loaded:', {
  apiKey: TWITTER_CREDENTIALS.apiKey ? `${TWITTER_CREDENTIALS.apiKey.substring(0, 8)}...` : 'NOT SET',
  apiSecret: TWITTER_CREDENTIALS.apiSecret ? `${TWITTER_CREDENTIALS.apiSecret.substring(0, 8)}...` : 'NOT SET',
  accessToken: TWITTER_CREDENTIALS.accessToken ? `${TWITTER_CREDENTIALS.accessToken.substring(0, 8)}...` : 'NOT SET',
  accessTokenSecret: TWITTER_CREDENTIALS.accessTokenSecret ? `${TWITTER_CREDENTIALS.accessTokenSecret.substring(0, 8)}...` : 'NOT SET'
});

// Initialize Firebase Admin SDK for toto-app-stg
if (!admin.apps.length) {
  try {
    let serviceAccount = null;
    
    // Try environment variable first (for production)
    const serviceAccountJson = process.env.TOTO_APP_STG_SERVICE_ACCOUNT_KEY;
    if (serviceAccountJson) {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log('✅ Using service account from environment variable');
    } else {
      // Try local file (for development)
      const fs = require('fs');
      const serviceAccountPath = path.join(__dirname, 'toto-f9d2f-stg-firebase-adminsdk-fbsvc-d4bdd9b852.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
        serviceAccount = JSON.parse(serviceAccountFile);
        console.log('✅ Using local service account file');
      }
    }
    
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'toto-f9d2f-stg'
      });
      console.log('✅ Firebase Admin SDK initialized for toto-app-stg');
    } else {
      console.log('⚠️ No service account credentials found, skipping toto-app-stg connection');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    console.log('Note: Service account credentials not available or invalid');
  }
}

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize TotoAI
const totoAI = new TotoAI();

// Initialize Scheduler Service
const schedulerService = new SchedulerService(totoAI);

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
        // Initialize with empty credentials for now (will be set when testing)
        const mockCredentials = {
          apiKey: '',
          apiSecret: '',
          accessToken: '',
          accessTokenSecret: ''
        };
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
        
        const mockCredentials = {
          apiKey: '',
          apiSecret: '',
          accessToken: '',
          accessTokenSecret: ''
        };
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
      
      const mockCredentials = {
        apiKey: '',
        apiSecret: '',
        accessToken: '',
        accessTokenSecret: ''
      };
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
    // For now, we'll use mock data
    const mockCredentials = {
      apiKey: 'mock_key',
      apiSecret: 'mock_secret',
      accessToken: 'mock_token',
      accessTokenSecret: 'mock_token_secret'
    };
    
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
    
    // Use environment variables if available, otherwise fall back to provided credentials
    const finalCredentials = {
      apiKey: TWITTER_CREDENTIALS.apiKey || credentials?.apiKey || '',
      apiSecret: TWITTER_CREDENTIALS.apiSecret || credentials?.apiSecret || '',
      accessToken: TWITTER_CREDENTIALS.accessToken || credentials?.accessToken || '',
      accessTokenSecret: TWITTER_CREDENTIALS.accessTokenSecret || credentials?.accessTokenSecret || ''
    };

    // Check if we have valid credentials
    if (!finalCredentials.apiKey || !finalCredentials.apiSecret || !finalCredentials.accessToken || !finalCredentials.accessTokenSecret) {
      return res.status(400).json({ 
        success: false, 
        error: 'Twitter API credentials not available. Please set environment variables or provide credentials manually.' 
      });
    }
    
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

    // Use dummy credentials for web scraping (API is disabled)
    const finalCredentials = {
      apiKey: 'dummy',
      apiSecret: 'dummy',
      accessToken: 'dummy',
      accessTokenSecret: 'dummy'
    };
    
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
          const mockCredentials = {
            apiKey: '',
            apiSecret: '',
            accessToken: '',
            accessTokenSecret: ''
          };
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

// Start server
app.listen(port, () => {
  console.log(`TotoAI server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Available agents: http://localhost:${port}/api/agents`);
  
  // Start the scheduler
  schedulerService.startAll();
});
