const express = require('express');
const path = require('path');
const { TotoAI } = require('./dist/index.js');
const admin = require('firebase-admin');

// Updated to trigger new deployment with fixed secret

// Initialize Firebase Admin SDK for toto-app-stg
if (!admin.apps.length) {
  try {
    // Use environment variables for service account
    const serviceAccount = {
      type: "service_account",
      project_id: "toto-f9d2f-stg",
      private_key_id: process.env.TOTO_APP_STG_PRIVATE_KEY_ID,
      private_key: process.env.TOTO_APP_STG_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.TOTO_APP_STG_CLIENT_EMAIL,
      client_id: process.env.TOTO_APP_STG_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.TOTO_APP_STG_CLIENT_EMAIL}`
    };
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'toto-f9d2f-stg'
    });
    console.log('✅ Firebase Admin SDK initialized for toto-app-stg');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    console.log('Note: Service account credentials not available in environment variables');
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

// Get cases from toto-app-stg
app.get('/api/cases', async (req, res) => {
  try {
    const db = admin.firestore();
    const casesSnapshot = await db.collection('cases')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    const cases = [];
    casesSnapshot.forEach(doc => {
      const caseData = doc.data();
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
        updatedAt: caseData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      });
    });
    
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
