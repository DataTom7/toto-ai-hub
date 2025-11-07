# Secrets Management Guide

This document describes how secrets and environment variables are managed in `toto-ai-hub`.

## 🔐 **Pattern Overview**

All secrets follow a consistent pattern:
1. **Secrets are stored in Google Secret Manager**
2. **Referenced in `apphosting.yaml`** using the `secret:` field
3. **Accessed via `process.env.VARIABLE_NAME`** in code
4. **No hardcoded values** - all sensitive data comes from secrets

## 📋 **Current Secrets**

### **Google AI**
- **Variable**: `GOOGLE_AI_API_KEY`
- **Secret Name**: `toto-ai-hub-google-ai-key-v2`
- **Usage**: Gemini API access

### **Firebase Service Accounts**
- **Variable**: `TOTO_APP_STG_SERVICE_ACCOUNT_KEY`
- **Secret Name**: `toto-app-stg-service-account`
- **Usage**: Access to toto-app-stg Firestore

- **Variable**: `TOTO_BO_SERVICE_ACCOUNT_KEY`
- **Secret Name**: `toto-bo-service-account`
- **Usage**: Access to toto-bo Firestore (shared KB)

### **Instagram Basic Display API**
- **Variable**: `INSTAGRAM_ACCESS_TOKEN`
- **Secret Name**: `toto-ai-hub-instagram-access-token`
- **Usage**: Instagram Basic Display API access token (global fallback)

- **Variable**: `INSTAGRAM_USER_ID`
- **Secret Name**: `toto-ai-hub-instagram-user-id`
- **Usage**: Instagram user ID for Basic Display API (global fallback)

### **Instagram Web Scraping (Fallback)**
- **Variable**: `INSTAGRAM_USERNAME`
- **Secret Name**: `toto-ai-hub-instagram-username`
- **Usage**: Instagram bot account username for web scraping

- **Variable**: `INSTAGRAM_PASSWORD`
- **Secret Name**: `toto-ai-hub-instagram-password`
- **Usage**: Instagram bot account password for web scraping

## 🏗️ **Configuration Pattern**

### **In `apphosting.yaml`**

```yaml
env:
  - variable: VARIABLE_NAME
    secret: secret-name-in-secret-manager
    availability:
      - BUILD
      - RUNTIME
```

### **In Code**

```typescript
// Access secret via environment variable
const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_AI_API_KEY not configured');
}
```

## 🔄 **Priority Order**

For guardian-specific credentials (like Instagram), the system uses this priority:

1. **Guardian-specific** (from Firestore) - `guardian.instagramAccessToken`
2. **Global secret** (from Secret Manager) - `process.env.INSTAGRAM_ACCESS_TOKEN`
3. **Fallback method** (web scraping with login)

## 📝 **Adding New Secrets**

### **Step 1: Create Secret in Google Secret Manager**

1. Go to [Google Cloud Console](https://console.cloud.google.com/security/secret-manager)
2. Select project: `toto-ai-hub`
3. Click "CREATE SECRET"
4. Enter secret name (e.g., `toto-ai-hub-new-secret`)
5. Enter secret value
6. Click "CREATE SECRET"

### **Step 2: Add to `apphosting.yaml`**

```yaml
env:
  - variable: NEW_SECRET_VARIABLE
    secret: toto-ai-hub-new-secret
    availability:
      - BUILD
      - RUNTIME
```

### **Step 3: Use in Code**

```typescript
const secretValue = process.env.NEW_SECRET_VARIABLE;
if (!secretValue) {
  console.warn('NEW_SECRET_VARIABLE not configured');
}
```

### **Step 4: Document**

Add the secret to this file (`SECRETS_MANAGEMENT.md`) under the appropriate section.

## 🧪 **Local Development**

For local development, secrets can be set in `.env` file:

```env
GOOGLE_AI_API_KEY=your_key_here
INSTAGRAM_ACCESS_TOKEN=your_token_here
INSTAGRAM_USER_ID=your_user_id_here
```

**Note**: Never commit `.env` files to git. They are in `.gitignore`.

## ⚠️ **Best Practices**

1. **Never hardcode secrets** - Always use environment variables
2. **Use descriptive secret names** - Follow the pattern: `toto-ai-hub-{service}-{purpose}`
3. **Document all secrets** - Keep this file updated
4. **Use guardian-specific tokens when possible** - More secure than global secrets
5. **Log secret usage** - But never log the actual secret values
6. **Validate secrets on startup** - Fail fast if required secrets are missing

## 🔍 **Troubleshooting**

### **Secret Not Found**

If you see errors like "Secret not found":
1. Check Secret Manager - ensure secret exists
2. Check `apphosting.yaml` - ensure secret name matches
3. Check variable name - ensure it matches in code
4. Redeploy - secrets are loaded at deployment time

### **Secret Not Accessible**

If secret exists but code can't access it:
1. Check `availability` in `apphosting.yaml` - should include `RUNTIME`
2. Check variable name - must match exactly
3. Check deployment logs - secrets are loaded during build/runtime

## 📚 **Related Documentation**

- [Firebase App Hosting Secrets](https://firebase.google.com/docs/app-hosting/configure-secrets)
- [Google Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Environment Variables Guide](./VERTEX_AI_SEARCH_SETUP.md)

