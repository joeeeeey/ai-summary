# AI Summary

## About the Project

[AI Summary](https://j2bqkag4wy.ap-southeast-1.awsapprunner.com/) is a powerful content analysis tool that leverages artificial intelligence to help users quickly extract meaning from various types of content. Whether you're analyzing PDFs, web articles, or engaging in follow-up conversations about the content, AI Summary provides intelligent, concise summaries and insights to save you time and enhance your understanding.

Built with modern web technologies and deployed on scalable cloud infrastructure, AI Summary is designed for professionals, researchers, and anyone who needs to process large volumes of text efficiently.

## Key Features

### Content Processing
- **Multiple Input Types**: Process PDFs, web links, and plain text content
- **Smart Summarization**: Get concise, meaningful summaries of complex content
- **Follow-up Questions**: Ask detailed questions about the content with context-aware responses
- **Vector Database Storage**: Store large documents for retrieval during follow-up questions
- **Hybrid Approach**: Initial summaries use truncated text, follow-ups use vector retrieval

### User Experience
- **Secure Authentication**: Email/password login with JWT-based security
- **Error Resilience**: Automatic/manual retry for failed AI processing requests
- **Conversation History**: Access all your past summaries and conversations
- **Responsive Design**: Optimized for both desktop and mobile experiences
- **Contextual Retrieval**: Get answers from specific sections of large documents during follow-ups

### Technical Capabilities
- **Analytics Dashboard**: Track usage metrics and content processing statistics
- **Cloud Deployment**: AWS App Runner configuration for seamless scaling
- **Database Integration**: MySQL for conversations, Pinecone for vector storage
- **Vector Search**: Semantic search for follow-up questions on large documents
- **Chunking & Embedding**: Large documents are processed for efficient retrieval

## Application Architecture

### Tech Stack
- **Frontend**: Next.js 14, React, Material UI, vercel/ai
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: MySQL for structured data, Pinecone for vector storage
- **AI Processing**: OpenAI API (GPT-4o for generation, text-embedding-ada-002 for embeddings)
- **Authentication**: JWT-based auth with secure password hashing
- **Cloud infrastructure**: AWS App Runner, ECR, RDS
- **Automation Deployment**: Terraform & Makefile

### System Design
```
┌─────────────┐     ┌────────────────┐     ┌───────────────┐
│  Web Client │────▶│ Next.js Server │────▶│ OpenAI API    │
└─────────────┘     └────────────────┘     └───────────────┘
                           │                       ▲
                           │                       │
                           ▼                       │
                    ┌────────────────┐     ┌───────────────┐
                    │ Prisma ORM     │     │ Vector Storage│
                    └────────────────┘     │ (Pinecone)    │
                           │               └───────────────┘
                           ▼                       ▲
                    ┌────────────────┐            │
                    │ MySQL Database │            │
                    └────────────────┘            │
                                                  │
                    ┌────────────────┐            │
                    │ Document       │────────────┘
                    │ Processing     │
                    └────────────────┘
```

### How It Works

The application uses a hybrid approach to document processing:

1. **Initial Processing**:
   - For first-time summaries, documents (PDF/link/text) are truncated if too large
   - A direct AI call is made to generate the initial summary
   - In parallel, the full document is chunked and stored in the vector database

2. **Follow-up Questions**:
   - When users ask follow-up questions, the vector database is queried
   - Relevant document chunks are retrieved based on semantic similarity
   - These chunks are added to the context sent to the AI model
   - The AI generates precise answers based on the retrieved content

This approach balances speed (quick initial summaries) with accuracy (detailed follow-up responses).

## Getting Started

### Prerequisites
- Node.js 22+ and npm/yarn
- MySQL database
- OpenAI API key
- Pinecone API key (for vector database features)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/ai-summary.git
cd ai-summary
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up environment variables
```bash
cp env.template .env.local
# Edit .env.local with your configuration
```

4. Set up the database
```sql
CREATE DATABASE ai_summary CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

5. Run Prisma migrations
```bash
npx prisma migrate deploy
```

6. Start the development server
```bash
npm run dev
# or
yarn dev
```

## Deployment

The project is configured for AWS deployment using Terraform:

```bash
# init
make tf-init
# plan
make tf-plan
# apply
make tf-apply
```

Update container image by:
```bash
make update-docker-image
```

After deployment, you can trigger new deployments with:

```bash
aws apprunner start-deployment --service-arn arn:aws:apprunner:ap-southeast-1:922446598046:service/ai-summary-app/29ea7e03880f49c5b2af67ce6f79df79
```

```bash
npx prisma generate

# To validate your schema without making any changes:
npx prisma validate

# apply existing migrations without creating new ones, use:
npx prisma migrate deploy
```