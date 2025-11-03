# Instagram Integration Testing Guide

## ✅ Unit Tests

All unit tests pass successfully:

```bash
npm test -- InstagramAgent.test.ts
```

**Test Results:**
- ✅ 14 tests passing
- ✅ All core functionality validated
- ✅ Error handling works correctly

## 🧪 API Endpoint Testing

### 1. Test Instagram Connection

```bash
curl -X POST http://localhost:3000/api/instagram/test-connection \
  -H "Content-Type: application/json" \
  -d '{"credentials": {}}'
```

### 2. Get Instagram Configuration

```bash
curl http://localhost:3000/api/instagram/config
```

### 3. Get Guardians with Instagram Accounts

```bash
curl http://localhost:3000/api/instagram/guardians
```

**Expected Response:**
```json
{
  "success": true,
  "guardians": [
    {
      "id": "guardian_id",
      "name": "Guardian Name",
      "instagramHandle": "instagram_handle",
      "isActive": true,
      ...
    }
  ]
}
```

### 4. Run Instagram Monitoring Cycle

```bash
curl -X POST http://localhost:3000/api/instagram/monitor \
  -H "Content-Type: application/json" \
  -d '{"credentials": {}}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Analyzed X posts, created Y case updates",
  "postsAnalyzed": 0,
  "storiesAnalyzed": 0,
  "caseUpdatesCreated": 0,
  "analysisResults": [],
  "metadata": {
    "agentType": "InstagramAgent",
    "confidence": 0.9,
    "processingTime": 123
  }
}
```

### 5. Get Monitoring Statistics

```bash
curl http://localhost:3000/api/instagram/stats
```

### 6. Get Review Queue Status

```bash
curl http://localhost:3000/api/instagram/review-queue
```

### 7. Get Review Queue Items

```bash
# Get all items
curl http://localhost:3000/api/instagram/review-queue/items

# Get with filters
curl "http://localhost:3000/api/instagram/review-queue/items?status=pending&limit=10"
```

### 8. Get Specific Review Item

```bash
curl http://localhost:3000/api/instagram/review-queue/items/ITEM_ID
```

### 9. Approve Review Item

```bash
curl -X POST http://localhost:3000/api/instagram/review-queue/items/ITEM_ID/approve \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Approved - looks good",
    "reviewedBy": "admin_user_id"
  }'
```

### 10. Reject Review Item

```bash
curl -X POST http://localhost:3000/api/instagram/review-queue/items/ITEM_ID/reject \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Rejected - not case related",
    "reviewedBy": "admin_user_id",
    "reason": "Not a rescue case"
  }'
```

### 11. Update Guardian Status

```bash
curl -X PUT http://localhost:3000/api/instagram/guardians/GUARDIAN_ID \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

### 12. Update Instagram Agent Configuration

```bash
curl -X PUT http://localhost:3000/api/instagram/config \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "monitoringInterval": 120,
      "maxPostsPerFetch": 20,
      "caseCreationPolicy": {
        "enabled": true,
        "requireApproval": true,
        "minConfidence": 0.8,
        "maxCasesPerDay": 5
      }
    }
  }'
```

## 🔍 Manual Testing Steps

### Step 1: Start the Server

```bash
cd toto-ai-hub
npm run dev
```

### Step 2: Test Basic Endpoints

1. Test connection - should return success
2. Get guardians - should load from database or return mock data
3. Get stats - should return zero counts initially

### Step 3: Run Monitoring Cycle

1. Ensure you have guardians with Instagram handles in the database
2. Run the monitor endpoint
3. Check the response for analyzed posts
4. If posts are found, check review queue for new items

### Step 4: Test Review Queue

1. If review items exist, fetch them
2. Approve one and verify it executes
3. Reject one and verify status updates

### Step 5: Test Configuration

1. Update monitoring interval
2. Verify configuration persists
3. Test invalid configuration (should reject)

## 📝 Expected Behavior

### With No Guardians
- Monitoring cycle returns: `"No new posts or stories found from guardians"`
- Stats show: `guardiansMonitored: 0`

### With Guardians but No Posts
- Monitoring cycle completes successfully
- `postsAnalyzed: 0`
- Review queue remains empty

### With Guardians and Posts
- Posts are fetched and analyzed
- Review items are created for case-related posts
- Review queue shows pending items
- Auto-approved items execute immediately

## 🐛 Common Issues

### 1. API Errors from Google Gemini
**Symptom:** `403 Forbidden` errors in logs
**Solution:** Set `GOOGLE_AI_API_KEY` environment variable

### 2. No Guardians Found
**Symptom:** Empty guardians array
**Solution:** 
- Check Firestore for users with `role: 'guardian'`
- Ensure they have `contactInfo.socialLinks.instagram` set

### 3. Instagram Scraping Fails
**Symptom:** Errors fetching posts
**Solution:**
- Instagram may block scraping attempts
- Use Instagram Basic Display API with access tokens instead
- Check Instagram service logs for specific errors

### 4. Review Items Not Created
**Symptom:** Posts analyzed but no review items
**Solution:**
- Check if posts are marked as case-related
- Verify review queue is enabled in configuration
- Check logs for skipped posts (non-case-related, duplicates, fundraising)

## ✨ Next Steps

1. **Add Instagram OAuth Flow** - For guardian authentication
2. **Implement Visual Analysis** - Image recognition for animals/conditions
3. **Add Story Support** - Monitor temporary story content
4. **Create Dashboard UI** - Visual interface for review queue
5. **Add Hashtag Tracking** - Monitor rescue-related hashtags

## 📊 Test Coverage

Current test coverage includes:
- ✅ Initialization
- ✅ Configuration management
- ✅ Guardian management
- ✅ Post analysis (with API fallback)
- ✅ Review queue operations
- ✅ Error handling
- ✅ Edge cases (empty lists, invalid configs)

一层

