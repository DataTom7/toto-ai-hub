# Running toto-ai-hub Locally

This guide helps you run toto-ai-hub locally for faster development and testing.

## Prerequisites

1. Node.js >= 18.0.0
2. Google AI API Key (set as `GOOGLE_AI_API_KEY` environment variable)
3. Firebase service account keys (optional, for Firestore access)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   GOOGLE_AI_API_KEY=your-api-key-here
   ```

3. **Build TypeScript:**
   ```bash
   npm run build
   ```

4. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Verify it's running:**
   - Health check: http://localhost:8080/health
   - Should return: `{"status":"healthy"}`

## Testing with toto-app

The toto-app will automatically detect if toto-ai-hub is running locally:
- In development mode (`__DEV__`), it checks `http://localhost:8080/health`
- If local server is available, it uses `http://localhost:8080`
- If not available, it falls back to production URL

## Troubleshooting

### Port 8080 already in use
Change the port by setting `PORT` environment variable:
```bash
PORT=3000 npm start
```

### CORS errors
The server is configured to allow:
- Any localhost port (for local development)
- Production/staging web domains
- React Native/Expo localhost

If you still see CORS errors, check that your client is using `http://localhost:8080` (not `https://`).

### API Key errors
Make sure `GOOGLE_AI_API_KEY` is set in your `.env` file or environment variables.

## Development Workflow

1. Start toto-ai-hub locally: `npm run dev`
2. Start toto-app (it will auto-detect local server)
3. Test changes immediately without deploying
4. When ready, commit and push to deploy to production

