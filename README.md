# AI Summary

![AI Summary](https://via.placeholder.com/800x400?text=AI+Summary)

## About the Project

AI Summary is a powerful content analysis tool that leverages artificial intelligence to help users quickly extract meaning from various types of content. Whether you're analyzing PDFs, web articles, or engaging in follow-up conversations about the content, AI Summary provides intelligent, concise summaries and insights to save you time and enhance your understanding.

Built with modern web technologies and deployed on scalable cloud infrastructure, AI Summary is designed for professionals, researchers, and anyone who needs to process large volumes of text efficiently.

## Key Features

### Content Processing
- **Multiple Input Types**: Process PDFs, web links, and plain text content
- **Smart Summarization**: Get concise, meaningful summaries of complex content
- **Follow-up Questions**: Ask questions about the content for deeper understanding

### User Experience
- **Secure Authentication**: Email/password login with JWT-based security
- **Error Resilience**: Automatic retry for failed AI processing requests
- **Conversation History**: Access all your past summaries and conversations
- **Responsive Design**: Optimized for both desktop and mobile experiences

### Technical Capabilities
- **Analytics Dashboard**: Track usage metrics and content processing statistics
- **Cloud Deployment**: AWS App Runner configuration for seamless scaling
- **Database Integration**: Structured data storage with MySQL/Prisma

## Application Architecture

### Tech Stack
- **Frontend**: Next.js 14, React, Material UI
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: MySQL
- **AI Processing**: OpenAI GPT-4o
- **Authentication**: JWT-based auth with secure password hashing
- **Deployment**: AWS App Runner, ECR, VPC, RDS
- **Infrastructure as Code**: Terraform

### System Design
```
┌─────────────┐     ┌────────────────┐     ┌───────────────┐
│  Web Client │────▶│ Next.js Server │────▶│ OpenAI API    │
└─────────────┘     └────────────────┘     └───────────────┘
                           │                       
                           ▼                       
                    ┌────────────────┐     ┌───────────────┐
                    │ Prisma ORM     │────▶│ MySQL Database│
                    └────────────────┘     └───────────────┘
```

### User Flow
1. User authenticates through secure login
2. Uploads content (PDF, link, or text)
3. AI processes the content and generates a summary
4. User can ask follow-up questions about the content
5. All conversations are saved for future reference
6. Analytics track usage patterns and system performance

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- MySQL database
- OpenAI API key

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
cd terraform
terraform init
terraform apply
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