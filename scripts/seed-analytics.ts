import { PrismaClient } from '@prisma/client';
import { AnalyticsEventType } from '../app/lib/analytics';

const prisma = new PrismaClient();

// Sample event types
const eventTypes: AnalyticsEventType[] = [
  'summarize_success',
  'pdf_upload',
  'linkurl_analysis',
  'user_login',
  'llm_token_usage',
  'user_registration',
  'thread_created',
  'error_occurred'
];

// Generate random date within a range
function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate random integer between min and max (inclusive)
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Generate random events
async function generateEvents(count: number) {
  console.log(`Generating ${count} random analytics events...`);
  
  // Get all users to associate events with
  const users = await prisma.user.findMany({
    select: { id: true }
  });
  
  if (users.length === 0) {
    console.error('No users found. Please create at least one user first.');
    return;
  }
  
  // Get all messages to associate some events with
  const messages = await prisma.message.findMany({
    select: { id: true, threadId: true }
  });
  
  // Prepare batch of events
  const events = [];
  
  // Start and end dates (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);
  
  for (let i = 0; i < count; i++) {
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const userId = users[Math.floor(Math.random() * users.length)].id;
    
    // Some events may have associated messages and threads
    let messageId = null;
    let threadId = null;
    
    if (messages.length > 0 && Math.random() > 0.3) {
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      messageId = randomMessage.id;
      threadId = randomMessage.threadId;
    }
    
    // Create event-specific properties
    let properties: Record<string, any> = {};
    
    switch (eventType) {
      case 'summarize_success':
        properties = {
          messageType: Math.random() > 0.7 ? 'pdf' : 'text',
          responseLength: randomInt(200, 3000)
        };
        break;
      case 'pdf_upload':
        properties = {
          fileName: `document_${randomInt(1, 100)}.pdf`,
          fileSize: randomInt(50000, 5000000),
          contentLength: randomInt(1000, 50000)
        };
        break;
      case 'linkurl_analysis':
        properties = {
          url: `https://example.com/page/${randomInt(1, 1000)}`,
          contentLength: randomInt(1000, 30000)
        };
        break;
      case 'llm_token_usage':
        properties = {
          promptTokens: randomInt(100, 2000),
          completionTokens: randomInt(100, 1000),
          totalTokens: randomInt(200, 3000),
          model: Math.random() > 0.2 ? 'gpt-4o' : 'gpt-3.5-turbo',
          cachedPromptTokens: Math.random() > 0.7
        };
        break;
      case 'error_occurred':
        properties = {
          errorType: ['api_error', 'pdf_processing', 'url_scraping', 'ai_generation'][randomInt(0, 3)],
          errorMessage: 'Simulated error message for testing'
        };
        break;
    }
    
    events.push({
      eventType,
      userId,
      messageId,
      threadId,
      properties,
      createdAt: randomDate(startDate, endDate)
    });
  }
  
  // Insert events in batches
  await prisma.analyticsEvent.createMany({
    data: events
  });
  
  console.log(`Successfully created ${count} analytics events.`);
}

async function main() {
  try {
    // Generate 500 random events
    await generateEvents(500);
  } catch (error) {
    console.error('Error seeding analytics data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 