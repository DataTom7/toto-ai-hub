# TotoAI Hub - API Documentation

## Twitter Monitoring Dashboard API Endpoints

This document outlines all the API endpoints available in `toto-ai-hub` for building a comprehensive Twitter Monitoring Dashboard in `toto-bo`.

### Base URL
```
https://your-toto-ai-hub-domain.com
```

---

## 🔍 **Core Monitoring Endpoints**

### **GET /health**
Health check and system status
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "agents": [
    {
      "name": "CaseAgent",
      "description": "Handles case-related inquiries",
      "version": "1.0.0",
      "capabilities": ["case_analysis", "donation_info", "conversational_ai"],
      "isEnabled": true
    },
    {
      "name": "TwitterAgent", 
      "description": "Monitors guardian Twitter accounts",
      "version": "1.0.0",
      "capabilities": ["tweet_fetching", "content_analysis", "case_update_creation"],
      "isEnabled": true
    }
  ]
}
```

### **GET /api/agents**
Get all available agents
```json
{
  "success": true,
  "agents": [
    {
      "name": "TwitterAgent",
      "description": "Monitors guardian Twitter accounts, analyzes tweets for case relevance, and creates case updates",
      "version": "1.0.0",
      "capabilities": ["tweet_fetching", "content_analysis", "case_update_creation", "emergency_detection", "fundraising_filtering", "pattern_learning", "case_creation"],
      "isEnabled": true,
      "maxRetries": 3,
      "timeout": 60000
    }
  ]
}
```

---

## 📊 **Statistics & Monitoring**

### **GET /api/twitter/stats**
Get comprehensive Twitter agent statistics
```json
{
  "success": true,
  "stats": {
    "guardiansMonitored": 5,
    "totalTweetsAnalyzed": 1247,
    "totalCaseUpdatesCreated": 89,
    "casesCreatedToday": 3,
    "maxCasesPerDay": 5,
    "caseCreationEnabled": true,
    "requireApproval": true,
    "reviewQueueStatus": {
      "totalItems": 12,
      "pendingItems": 8,
      "approvedItems": 3,
      "rejectedItems": 1,
      "autoApprovedItems": 0,
      "itemsByType": {
        "case_creation": 4,
        "case_update": 6,
        "case_enrichment": 2
      },
      "itemsByUrgency": {
        "critical": 1,
        "high": 3,
        "medium": 5,
        "low": 3
      }
    },
    "lastRun": "2024-01-15T10:25:00.000Z"
  }
}
```

### **GET /api/twitter/analytics**
Get historical analytics and trends
```json
{
  "success": true,
  "analytics": {
    "period": "7 days",
    "type": "all",
    "summary": {
      "totalTweetsAnalyzed": 1247,
      "totalCaseUpdatesCreated": 89,
      "casesCreatedToday": 3,
      "reviewItemsProcessed": 12
    },
    "trends": {
      "tweetsPerDay": 178,
      "updatesPerDay": 12,
      "casesPerDay": 0
    },
    "reviewQueueStats": {
      "totalItems": 12,
      "pendingItems": 8,
      "approvedItems": 3,
      "rejectedItems": 1,
      "autoApprovedItems": 0
    },
    "guardianActivity": [
      {
        "id": "guardian_1",
        "name": "Maria Fernandez",
        "isActive": true,
        "lastTweetFetch": "2024-01-15T10:20:00.000Z"
      }
    ]
  }
}
```

**Query Parameters:**
- `days` (optional): Number of days for analytics (default: 7)
- `type` (optional): Type of analytics - 'all', 'tweets', 'updates', 'cases' (default: 'all')

---

## 📋 **Review Queue Management**

### **GET /api/twitter/review-queue**
Get review queue summary
```json
{
  "success": true,
  "reviewStatus": {
    "totalItems": 12,
    "pendingItems": 8,
    "approvedItems": 3,
    "rejectedItems": 1,
    "autoApprovedItems": 0,
    "itemsByType": {
      "case_creation": 4,
      "case_update": 6,
      "case_enrichment": 2
    },
    "itemsByUrgency": {
      "critical": 1,
      "high": 3,
      "medium": 5,
      "low": 3
    }
  }
}
```

### **GET /api/twitter/review-queue/items**
Get detailed review queue items with filtering and pagination
```json
{
  "success": true,
  "items": [
    {
      "id": "review_1705312200000_abc123",
      "type": "case_creation",
      "status": "pending",
      "tweetId": "tweet_123456789",
      "tweetContent": "Luna needs urgent surgery! Please help us raise funds for her treatment.",
      "tweetAuthor": "maria_fernandez",
      "guardianId": "guardian_1",
      "caseId": null,
      "proposedAction": {
        "action": "create_case",
        "caseData": {
          "name": "Luna's Urgent Surgery",
          "description": "Luna needs urgent surgery for her condition...",
          "animalType": "dog",
          "medicalCondition": "surgery required",
          "donationGoal": 5000,
          "priority": "urgent"
        },
        "images": ["https://example.com/luna1.jpg"]
      },
      "confidence": 0.92,
      "urgency": "critical",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "metadata": {
        "analysisResult": {
          "isCaseRelated": true,
          "urgency": "critical",
          "caseUpdateType": "emergency",
          "suggestedAction": "Create new case for Luna's urgent surgery",
          "confidence": 0.92,
          "extractedInfo": {
            "animalMentioned": "Luna",
            "medicalCondition": "surgery",
            "emergency": true,
            "fundraisingRequest": true
          }
        },
        "images": ["https://example.com/luna1.jpg"]
      }
    }
  ],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

**Query Parameters:**
- `status` (optional): Filter by status - 'pending', 'approved', 'rejected', 'auto_approved'
- `type` (optional): Filter by type - 'case_creation', 'case_update', 'case_enrichment'
- `urgency` (optional): Filter by urgency - 'critical', 'high', 'medium', 'low'
- `limit` (optional): Number of items per page (default: 50)
- `offset` (optional): Number of items to skip (default: 0)

### **GET /api/twitter/review-queue/items/:itemId**
Get specific review item details
```json
{
  "success": true,
  "item": {
    "id": "review_1705312200000_abc123",
    "type": "case_creation",
    "status": "pending",
    "tweetId": "tweet_123456789",
    "tweetContent": "Luna needs urgent surgery! Please help us raise funds for her treatment.",
    "tweetAuthor": "maria_fernandez",
    "guardianId": "guardian_1",
    "caseId": null,
    "proposedAction": {
      "action": "create_case",
      "caseData": {
        "name": "Luna's Urgent Surgery",
        "description": "Luna needs urgent surgery for her condition...",
        "animalType": "dog",
        "medicalCondition": "surgery required",
        "donationGoal": 5000,
        "priority": "urgent"
      },
      "images": ["https://example.com/luna1.jpg"]
    },
    "confidence": 0.92,
    "urgency": "critical",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "metadata": {
      "analysisResult": {
        "isCaseRelated": true,
        "urgency": "critical",
        "caseUpdateType": "emergency",
        "suggestedAction": "Create new case for Luna's urgent surgery",
        "confidence": 0.92,
        "extractedInfo": {
          "animalMentioned": "Luna",
          "medicalCondition": "surgery",
          "emergency": true,
          "fundraisingRequest": true
        }
      },
      "images": ["https://example.com/luna1.jpg"]
    }
  }
}
```

### **POST /api/twitter/review-queue/items/:itemId/approve**
Approve a review item
```json
// Request Body
{
  "notes": "Approved - clear emergency case with good documentation",
  "reviewedBy": "admin_user_id"
}

// Response
{
  "success": true,
  "message": "Review item approved and action executed"
}
```

### **POST /api/twitter/review-queue/items/:itemId/reject**
Reject a review item
```json
// Request Body
{
  "notes": "Rejected - insufficient information for case creation",
  "reviewedBy": "admin_user_id",
  "reason": "insufficient_information"
}

// Response
{
  "success": true,
  "message": "Review item rejected"
}
```

---

## ⚙️ **Configuration Management**

### **GET /api/twitter/config**
Get current Twitter agent configuration
```json
{
  "success": true,
  "config": {
    "name": "TwitterAgent",
    "description": "Monitors guardian Twitter accounts, analyzes tweets for case relevance, and creates case updates",
    "version": "1.0.0",
    "capabilities": ["tweet_fetching", "content_analysis", "case_update_creation", "emergency_detection", "fundraising_filtering", "pattern_learning", "case_creation"],
    "isEnabled": true,
    "maxRetries": 3,
    "timeout": 60000,
    "twitterCredentials": {
      "apiKey": "***",
      "apiSecret": "***",
      "accessToken": "***",
      "accessTokenSecret": "***"
    },
    "guardians": [
      {
        "id": "guardian_1",
        "name": "Maria Fernandez",
        "twitterHandle": "maria_fernandez",
        "twitterUserId": "123456789",
        "isActive": true,
        "lastTweetFetch": "2024-01-15T10:20:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-15T10:20:00.000Z"
      }
    ],
    "monitoringInterval": 60,
    "maxTweetsPerFetch": 10,
    "searchTimeWindow": 24,
    "caseCreationPolicy": {
      "enabled": true,
      "requireApproval": true,
      "minConfidence": 0.8,
      "maxCasesPerDay": 5
    },
    "reviewPolicy": {
      "requireManualReview": true,
      "autoApproveThreshold": 0.95,
      "reviewQueueEnabled": true,
      "notifyOnReview": true
    }
  }
}
```

### **PUT /api/twitter/config**
Update Twitter agent configuration
```json
// Request Body
{
  "config": {
    "caseCreationPolicy": {
      "enabled": true,
      "requireApproval": true,
      "minConfidence": 0.85,
      "maxCasesPerDay": 10
    },
    "reviewPolicy": {
      "requireManualReview": true,
      "autoApproveThreshold": 0.9,
      "reviewQueueEnabled": true,
      "notifyOnReview": true
    },
    "monitoringInterval": 30,
    "maxTweetsPerFetch": 15,
    "searchTimeWindow": 48
  }
}

// Response
{
  "success": true,
  "message": "Configuration updated successfully"
}
```

---

## 👥 **Guardian Management**

### **GET /api/twitter/guardians**
Get all monitored guardians
```json
{
  "success": true,
  "guardians": [
    {
      "id": "guardian_1",
      "name": "Maria Fernandez",
      "twitterHandle": "maria_fernandez",
      "twitterUserId": "123456789",
      "isActive": true,
      "lastTweetFetch": "2024-01-15T10:20:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:20:00.000Z"
    },
    {
      "id": "guardian_2",
      "name": "Diego Martinez",
      "twitterHandle": "diego_rescue",
      "twitterUserId": "987654321",
      "isActive": false,
      "lastTweetFetch": "2024-01-10T15:30:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-10T15:30:00.000Z"
    }
  ]
}
```

### **PUT /api/twitter/guardians/:guardianId**
Update guardian monitoring status
```json
// Request Body
{
  "isActive": false,
  "twitterHandle": "new_handle",
  "twitterUserId": "new_user_id"
}

// Response
{
  "success": true,
  "message": "Guardian updated successfully"
}
```

---

## 🐦 **Tweet Management**

### **GET /api/twitter/tweets**
Get recent tweets from guardians
```json
{
  "success": true,
  "tweets": [
    {
      "id": "tweet_123456789",
      "content": "Luna is doing much better after her surgery! Thank you for all the support.",
      "author": {
        "name": "Maria Fernandez",
        "handle": "maria_fernandez",
        "profileImageUrl": "https://example.com/profile.jpg"
      },
      "metrics": {
        "likes": 15,
        "retweets": 3,
        "replies": 2
      },
      "media": {
        "images": ["https://example.com/luna1.jpg"],
        "videos": []
      },
      "createdAt": "2024-01-15T08:30:00.000Z",
      "fetchedAt": "2024-01-15T10:20:00.000Z"
    }
  ]
}
```

**Query Parameters:**
- `guardianId` (optional): Filter by specific guardian
- `limit` (optional): Number of tweets to return (default: 20)
- `hours` (optional): Hours to look back (default: 24)

### **POST /api/twitter/test-connection**
Test Twitter API connection
```json
// Request Body
{
  "credentials": {
    "apiKey": "your_api_key",
    "apiSecret": "your_api_secret",
    "accessToken": "your_access_token",
    "accessTokenSecret": "your_access_token_secret"
  }
}

// Response
{
  "success": true,
  "message": "Twitter connection test successful"
}
```

### **POST /api/twitter/simulate-fetch**
Simulate tweet fetching for testing (returns mock tweets and analysis)
```json
// Request Body
{
  "guardianId": "guardian_1",
  "limit": 3
}

// Response
{
  "success": true,
  "tweets": [
    {
      "id": "test_tweet_1705312200000_1",
      "content": "Luna needs urgent surgery! Please help us raise funds for her treatment. She has a broken leg and needs immediate care.",
      "author": {
        "name": "Maria Fernandez",
        "handle": "maria_fernandez",
        "profileImageUrl": "https://example.com/profile.jpg"
      },
      "metrics": {
        "likes": 25,
        "retweets": 8,
        "replies": 5
      },
      "media": {
        "images": ["https://example.com/luna_injury.jpg", "https://example.com/luna_xray.jpg"],
        "videos": []
      },
      "createdAt": "2024-01-15T08:30:00.000Z",
      "fetchedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "analysisResults": [
    {
      "isCaseRelated": true,
      "urgency": "critical",
      "caseUpdateType": "emergency",
      "suggestedAction": "Create new case for Luna's urgent surgery",
      "confidence": 0.92,
      "extractedInfo": {
        "animalMentioned": "Luna",
        "medicalCondition": "surgery",
        "emergency": true,
        "fundraisingRequest": true
      }
    }
  ],
  "proposedActions": [
    {
      "id": "review_1705312200000_abc123",
      "type": "case_creation",
      "status": "pending",
      "tweetId": "test_tweet_1705312200000_1",
      "tweetContent": "Luna needs urgent surgery! Please help us raise funds for her treatment. She has a broken leg and needs immediate care.",
      "tweetAuthor": "maria_fernandez",
      "guardianId": "guardian_1",
      "proposedAction": {
        "action": "create_case",
        "caseData": {
          "name": "Luna's Urgent Surgery",
          "description": "Luna needs urgent surgery for her broken leg...",
          "animalType": "dog",
          "medicalCondition": "broken leg requiring surgery",
          "donationGoal": 5000,
          "priority": "urgent"
        },
        "images": ["https://example.com/luna_injury.jpg", "https://example.com/luna_xray.jpg"]
      },
      "confidence": 0.92,
      "urgency": "critical",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "originalTweet": {
        // Full original tweet data for manual review
      }
    }
  ]
}
```

---

## 🚀 **Operations**

### **POST /api/twitter/monitor**
Run Twitter monitoring cycle manually
```json
// Response
{
  "success": true,
  "message": "Analyzed 15 tweets, created 3 case updates",
  "tweetsAnalyzed": 15,
  "caseUpdatesCreated": 3,
  "analysisResults": [
    {
      "isCaseRelated": true,
      "urgency": "medium",
      "caseUpdateType": "note",
      "suggestedAction": "Create case update for Luna's progress",
      "confidence": 0.87,
      "extractedInfo": {
        "animalMentioned": "Luna",
        "medicalProgress": "recovering well",
        "fundraisingRequest": false
      }
    }
  ],
  "metadata": {
    "agentType": "TwitterAgent",
    "confidence": 0.9,
    "processingTime": 12500
  }
}
```

---

## 📊 **Dashboard Integration Examples**

### **Dashboard Overview Widget**
```javascript
// Fetch all key metrics for dashboard overview
const [stats, reviewQueue, analytics] = await Promise.all([
  fetch('/api/twitter/stats').then(r => r.json()),
  fetch('/api/twitter/review-queue').then(r => r.json()),
  fetch('/api/twitter/analytics?days=7').then(r => r.json())
]);
```

### **Review Queue Management**
```javascript
// Get pending items for review
const pendingItems = await fetch('/api/twitter/review-queue/items?status=pending&limit=10')
  .then(r => r.json());

// Approve an item
await fetch(`/api/twitter/review-queue/items/${itemId}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notes: 'Approved after review',
    reviewedBy: 'admin_user_id'
  })
});
```

### **Configuration Management**
```javascript
// Update monitoring settings
await fetch('/api/twitter/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: {
      monitoringInterval: 30,
      maxTweetsPerFetch: 20,
      caseCreationPolicy: {
        requireApproval: false,
        minConfidence: 0.9
      }
    }
  })
});
```

---

## 🔒 **Security & Authentication**

**Note:** All endpoints currently return mock data and don't implement authentication. For production use, implement:

1. **API Key Authentication** - Add API key validation
2. **Rate Limiting** - Prevent abuse
3. **CORS Configuration** - Restrict cross-origin requests
4. **Input Validation** - Validate all request parameters
5. **Audit Logging** - Log all administrative actions

---

## 🚨 **Error Handling**

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## 📈 **Performance Considerations**

- **Pagination**: Use `limit` and `offset` for large datasets
- **Caching**: Consider caching frequently accessed data
- **Rate Limiting**: Implement rate limiting for API calls
- **Async Processing**: Long-running operations should be asynchronous

---

This API provides everything needed to build a comprehensive Twitter Monitoring Dashboard in `toto-bo` without requiring any modifications to the `toto-bo` codebase. The dashboard can be built as a separate module that consumes these endpoints.
