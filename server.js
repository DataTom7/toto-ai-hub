const express = require('express');
const path = require('path');
const { TotoAI } = require('./dist/index.js');
const admin = require('firebase-admin');

// Updated to trigger new deployment with fixed secret

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

// Get available agents
app.get('/api/agents', (req, res) => {
  try {
    const agents = totoAI.getAvailableAgents();
    res.json({ success: true, agents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
});
