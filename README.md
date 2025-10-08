# toto-ai

Clean AI agent system for the Toto platform using LangChain + Google Gemini.

## Overview

toto-ai is a focused, clean implementation of AI agents for the Toto pet rescue platform. It uses LangChain for agent orchestration and Google Gemini for the AI model.

## Features

- **CaseAgent**: Handles case-specific user interactions
- **LangChain Integration**: Modern agent framework
- **Google Gemini**: High-quality AI model
- **TypeScript**: Full type safety
- **Clean Architecture**: No legacy code or technical debt

## Installation

```bash
npm install toto-ai
```

## Usage

### Basic Usage

```typescript
import { TotoAI } from 'toto-ai';

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
import { CaseAgent } from 'toto-ai';

const caseAgent = new CaseAgent();

const response = await caseAgent.processCaseInquiry(
  "Tell me about this case",
  caseData,
  userContext
);
```

## Environment Variables

```bash
GOOGLE_AI_API_KEY=your_gemini_api_key
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
toto-ai/
├── src/
│   ├── agents/
│   │   ├── BaseAgent.ts      # Base agent class
│   │   └── CaseAgent.ts      # Case-specific agent
│   ├── services/             # (Future) Agent services
│   ├── types/
│   │   └── index.ts          # Type definitions
│   └── index.ts              # Main exports
├── tests/                    # Test files
└── dist/                     # Built files
```

## Integration

### With toto-app

```typescript
// toto-app/src/services/TotoGateway.ts
import { TotoAI } from 'toto-ai';

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
import { TotoAI } from 'toto-ai';

export async function GET() {
  const totoAI = new TotoAI();
  const agents = totoAI.getAvailableAgents();
  return NextResponse.json(agents);
}
```

## Roadmap

- [ ] TwitterAgent for tweet monitoring
- [ ] OrchestratorService for agent coordination
- [ ] LearningService for agent improvement
- [ ] ApprovalService for human-in-the-loop
- [ ] Firebase integration for data persistence

## License

UNLICENSED - Toto Team
