# TotoAI Hub

Clean AI agent system for the Toto platform using Google Gemini. This is the evolution of toto-agent - a focused, modern implementation with no legacy code.

## Overview

TotoAI Hub is a focused, clean implementation of AI agents for the Toto pet rescue platform. It uses Google Gemini for the AI model and provides a modern, maintainable codebase without legacy dependencies.

## Features

- **CaseAgent**: Handles case-specific user interactions
- **TwitterAgent**: Monitors guardian Twitter accounts and analyzes tweets
- **SchedulerService**: Automated tweet monitoring with cron jobs
- **Google Gemini**: High-quality AI model
- **TypeScript**: Full type safety
- **Clean Architecture**: No legacy code or technical debt
- **Modern Dependencies**: Up-to-date packages and best practices
- **Firebase Integration**: Connected to toto-app-stg database
- **Review Queue System**: Manual approval for case updates

## Installation

```bash
npm install toto-ai-hub
```

## Usage

### Basic Usage

```typescript
import { TotoAI } from 'toto-ai-hub';

const totoAI = new TotoAI();

// Process a case-related message
const response = await totoAI.processCaseMessage(
  "I want to help this case",
  caseData,
  userContext
);
```

### Using Individual Agents

```typescript
import { CaseAgent, TwitterAgent } from 'toto-ai-hub';

const caseAgent = new CaseAgent();
const twitterAgent = new TwitterAgent();

// Case-specific interaction
const caseResponse = await caseAgent.processCaseInquiry(
  "Tell me about this case",
  caseData,
  userContext
);

// Twitter monitoring
const twitterResponse = await twitterAgent.analyzeTweet(
  tweetContent,
  caseData,
  guardianContext
);
```

## Environment Variables

```bash
# Google AI Configuration
GOOGLE_AI_API_KEY=your_gemini_api_key

# Twitter API Configuration (for TwitterAgent)
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret

# Firebase Configuration (for data persistence)
TOTO_APP_STG_SERVICE_ACCOUNT_KEY=your_firebase_service_account_json

# Server Configuration
PORT=8080
NODE_ENV=production
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev
```

## Architecture

```
toto-ai-hub/
├── src/
│   ├── agents/
│   │   ├── BaseAgent.ts      # Base agent class
│   │   ├── CaseAgent.ts      # Case-specific agent
│   │   └── TwitterAgent.ts   # Twitter monitoring agent
│   ├── services/
│   │   ├── SchedulerService.ts  # Automated task scheduling
│   │   └── TwitterService.ts    # Twitter API integration
│   ├── types/
│   │   └── index.ts          # Type definitions
│   └── index.ts              # Main exports
├── tests/                    # Test files
├── dist/                     # Built files
├── server.js                 # Express server
└── public/                   # Static files
```

## Integration

### With toto-app

```typescript
// toto-app/src/services/TotoGateway.ts
import { TotoAI } from 'toto-ai-hub';

const totoAI = new TotoAI();

export class TotoGateway {
  async sendMessage(userMessage: string, context: TotoContext) {
    if (context.caseId) {
      return await totoAI.processCaseMessage(
        userMessage,
        context.caseData,
        context.userContext
      );
    }
    // Handle other cases...
  }
}
```

### With toto-bo

```typescript
// toto-bo/src/app/api/ai/agents/route.ts
import { TotoAI } from 'toto-ai-hub';

export async function GET() {
  const totoAI = new TotoAI();
  const agents = totoAI.getAvailableAgents();
  return NextResponse.json(agents);
}
```

## Current Status

### ✅ Completed
- [x] TwitterAgent for tweet monitoring
- [x] SchedulerService for automated monitoring
- [x] Firebase integration for data persistence
- [x] Review queue system for manual approval
- [x] Case enrichment from tweets
- [x] Emergency detection
- [x] Image processing and storage

### 🔄 In Progress
- [ ] Production deployment
- [ ] Authentication system
- [ ] Performance optimization

### 📋 Future
- [ ] OrchestratorService for agent coordination
- [ ] LearningService for agent improvement
- [ ] Analytics dashboard
- [ ] Webhook integration

## 📚 Documentation

**All documentation has been moved to the centralized [toto-docs](https://github.com/your-org/toto-docs) repository:**

- **📖 [Main Documentation](https://github.com/your-org/toto-docs)** - Complete ecosystem overview
- **🤖 [AI System Guide](https://github.com/your-org/toto-docs/tree/main/ai-system)** - Current AI system documentation
- **🚀 [Deployment Guide](https://github.com/your-org/toto-docs/tree/main/deployment)** - Setup and deployment instructions
- **📋 [API Reference](https://github.com/your-org/toto-docs/tree/main/api-reference)** - Complete API documentation

## License

UNLICENSED - Toto Team
