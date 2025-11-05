# Shared Knowledge Base Architecture

## Overview

The Knowledge Base (KB) is now stored in a **shared Firestore project** (`toto-bo`) to ensure that all environments (staging and production) access the same KB entries, eliminating duplication and ensuring consistency.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Shared KB Storage                      │
│              toto-bo Firestore (Production)              │
│              Collection: knowledge_base                  │
└─────────────────────────────────────────────────────────┘
                        ▲                    ▲
                        │                    │
        ┌───────────────┴────────┐  ┌───────┴──────────────┐
        │                         │  │                      │
┌───────▼────────┐      ┌────────▼──▼────────┐  ┌─────────▼────────┐
│  toto-ai-hub   │      │   toto-ai-hub       │  │     toto-bo      │
│   (Staging)    │      │  (Production)       │  │  (Management UI) │
└────────────────┘      └─────────────────────┘  └──────────────────┘
```

## Key Benefits

✅ **Single Source of Truth**: One KB shared across all environments  
✅ **No Duplication**: Staging and production use the same entries  
✅ **Consistent Behavior**: Agents behave identically across environments  
✅ **Centralized Management**: KB managed via toto-bo UI in one place  
✅ **Easy Updates**: Changes in toto-bo UI immediately available to all environments  

## Implementation Details

### 1. KnowledgeBaseService

The `KnowledgeBaseService` now accepts an optional `sharedKbFirestore` parameter:

```typescript
constructor(sharedKbFirestore?: admin.firestore.Firestore)
```

- If provided: Uses the shared Firestore instance (toto-bo)
- If not provided: Falls back to default Firestore (for backward compatibility)

### 2. TotoAPIGateway

The `TotoAPIGateway` accepts and passes the shared Firestore to `KnowledgeBaseService`:

```typescript
constructor(sharedKbFirestore?: admin.firestore.Firestore)
```

### 3. Server Initialization

`server.js` initializes toto-bo Firebase Admin SDK and passes it to the API Gateway:

```javascript
const sharedKbFirestore = getTotoBoFirestore();
const apiGateway = new TotoAPIGateway(sharedKbFirestore);
```

## Configuration

### Environment Variables

#### toto-ai-hub (apphosting.yaml)

Add the toto-bo service account secret:

```yaml
env:
  - variable: TOTO_BO_SERVICE_ACCOUNT_KEY
    secret: toto-bo-service-account
    availability:
      - BUILD
      - RUNTIME
```

### Firebase Secret Setup

1. **Create Service Account**:
   - Go to Google Cloud Console → `toto-bo` project
   - IAM & Admin → Service Accounts
   - Create or use existing service account for toto-ai-hub access

2. **Grant Permissions**:
   - Firestore: `Cloud Datastore User` role
   - Read/Write access to `knowledge_base` collection

3. **Store Secret**:
   - Download service account JSON
   - Store entire JSON as secret: `toto-bo-service-account` in Google Secret Manager
   - Ensure secret is accessible to toto-ai-hub App Hosting service

## Migration

### Current State

- KB entries currently in: `toto-f9d2f-stg` Firestore (staging)
- Need to migrate to: `toto-bo` Firestore (shared)

### Migration Steps

1. **Update Migration Script**:
   - Change target project from `toto-f9d2f-stg` to `toto-bo`
   - Use toto-bo service account credentials

2. **Run Migration**:
   ```bash
   cd toto-ai-hub
   npx ts-node scripts/migrate-knowledge-base.ts
   ```

3. **Verify Migration**:
   - Check Firebase Console → `toto-bo` → Firestore
   - Verify `knowledge_base` collection has all entries
   - Check both staging and production toto-ai-hub can access KB

## Verification

### Local Development

1. Ensure `toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json` exists
2. Start toto-ai-hub: `npm start`
3. Check logs for: `📚 Using shared KB Firestore (toto-bo) for cross-environment access`
4. Test API: `curl http://localhost:8080/api/ai/knowledge`

### Staging/Production

1. Verify secret `toto-bo-service-account` exists in Secret Manager
2. Deploy toto-ai-hub
3. Check Cloud Run logs for initialization messages
4. Test API: `curl https://toto-ai-hub-backend--toto-ai-hub.us-central1.hosted.app/api/ai/knowledge`

## Troubleshooting

### Issue: KB not accessible

**Symptoms**: Empty KB or errors accessing KB

**Solutions**:
1. Check `TOTO_BO_SERVICE_ACCOUNT_KEY` is set in environment
2. Verify service account has Firestore permissions
3. Check logs for Firebase initialization errors
4. Ensure `getTotoBoFirestore()` returns non-null

### Issue: Fallback to default Firestore

**Symptoms**: Logs show `⚠️ No shared KB Firestore available`

**Solutions**:
1. Verify toto-bo service account is initialized
2. Check `totoBoApp` is not null
3. Ensure service account JSON is valid

## Future Considerations

- **KB Versioning**: Consider adding version tracking for KB entries
- **Environment-Specific Overrides**: Allow some entries to be environment-specific if needed
- **KB Replication**: Consider cross-region replication for global access
- **Backup Strategy**: Regular backups of shared KB

