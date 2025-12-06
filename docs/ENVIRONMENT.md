# Environment Variables Reference

Complete reference for all environment variables in toto-ai-hub.

## Required Variables

### Firebase Admin SDK

```env
TOTO_BO_SERVICE_ACCOUNT_KEY=<JSON service account key>
```

**Description:** Firebase Admin SDK service account credentials in JSON format.

**Format:** Complete JSON object as string

**Example:**
```env
TOTO_BO_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"toto-bo-stg",...}
```

**How to get:**
1. Go to Firebase Console → Project Settings
2. Service Accounts tab
3. Generate new private key
4. Copy entire JSON content

---

### Gemini AI API

```env
GOOGLE_AI_API_KEY=<your-api-key>
```

**Description:** Google Gemini API key for conversational AI.

**Required for:** CaseAgent conversational responses

**How to get:**
1. Go to https://makersuite.google.com/app/apikey
2. Create API key
3. Copy and paste

---

## Optional Variables

### Vertex AI (Production Embeddings)

```env
VERTEX_AI_PROJECT_ID=<gcp-project-id>
VERTEX_AI_LOCATION=us-central1
```

**Description:** Google Cloud Vertex AI configuration for production-grade embeddings.

**Default:** Falls back to hash-based embeddings if not set

**When to use:** Production deployments for better embedding quality

---

### Banking Configuration

```env
TRF_BANKING_ALIAS=toto.fondo.rescate
```

**Description:** Banking alias for Toto Rescue Fund (TRF).

**Default:** `toto.fondo.rescate`

**When to change:** Different banking setup or testing

---

### Cache Configuration

```env
ENABLE_CACHING=true
LOG_CACHE_STATS=false
```

**Description:**
- `ENABLE_CACHING` - Enable/disable all caching layers
- `LOG_CACHE_STATS` - Log cache statistics (for debugging)

**Default:**
- `ENABLE_CACHING=true`
- `LOG_CACHE_STATS=false`

**When to disable:** Testing, debugging cache behavior

---

### Logging & Debugging

```env
NODE_ENV=production
LOG_LEVEL=info
```

**Description:**
- `NODE_ENV` - Environment mode
- `LOG_LEVEL` - Logging verbosity

**Values:**
- `NODE_ENV`: `development`, `production`, `test`
- `LOG_LEVEL`: `error`, `warn`, `info`, `debug`

---

## Environment-Specific Configuration

### Development (.env.development)

```env
# Firebase
TOTO_BO_SERVICE_ACCOUNT_KEY=<staging credentials>

# AI
GOOGLE_AI_API_KEY=<dev api key>

# Features
ENABLE_CACHING=true
LOG_CACHE_STATS=true

# Logging
NODE_ENV=development
LOG_LEVEL=debug
```

### Production (.env.production)

```env
# Firebase
TOTO_BO_SERVICE_ACCOUNT_KEY=<production credentials>

# AI
GOOGLE_AI_API_KEY=<production api key>
VERTEX_AI_PROJECT_ID=toto-bo
VERTEX_AI_LOCATION=us-central1

# Features
ENABLE_CACHING=true
LOG_CACHE_STATS=false

# Logging
NODE_ENV=production
LOG_LEVEL=info
```

### Testing (.env.test)

```env
# Firebase
TOTO_BO_SERVICE_ACCOUNT_KEY=<test credentials>

# AI (optional for unit tests)
# GOOGLE_AI_API_KEY=<test api key>

# Features
ENABLE_CACHING=false
LOG_CACHE_STATS=false

# Logging
NODE_ENV=test
LOG_LEVEL=error
```

---

## Security Best Practices

### 1. Never Commit .env Files

Add to `.gitignore`:

```
.env
.env.*
!.env.example
```

### 2. Use Environment-Specific Files

```bash
# Development
cp .env.example .env.development

# Production
cp .env.example .env.production
```

### 3. Rotate Keys Regularly

- Gemini API keys: Rotate every 90 days
- Service account keys: Rotate every 180 days

### 4. Limit Permissions

Service account should have minimal permissions:
- Firestore: Read/Write to specific collections only
- Vertex AI: Prediction only (no training)

---

## Validation

Check your environment configuration:

```bash
npm run check-env
```

Or programmatically:

```typescript
import { validateEnvironment } from 'toto-ai-hub/config';

const errors = validateEnvironment();
if (errors.length > 0) {
  console.error('Environment validation failed:', errors);
  process.exit(1);
}
```

---

## Troubleshooting

### "TOTO_BO_SERVICE_ACCOUNT_KEY is not valid JSON"

**Problem:** Malformed JSON in environment variable

**Solution:**
1. Ensure entire JSON is on one line
2. Escape quotes if needed for your shell
3. Use .env file instead of shell export

### "GOOGLE_AI_API_KEY is invalid"

**Problem:** API key not working

**Solution:**
1. Verify key is active in Google AI Studio
2. Check if API is enabled for your project
3. Ensure no leading/trailing whitespace

### "Cannot connect to Vertex AI"

**Problem:** Vertex AI credentials missing or invalid

**Solution:**
1. Verify `VERTEX_AI_PROJECT_ID` matches your GCP project
2. Check service account has Vertex AI permissions
3. Verify `VERTEX_AI_LOCATION` is valid region

---

For integration details, see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

