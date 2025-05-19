import { PrismaClient } from '@prisma/client';

// Use a single instance of PrismaClient
const prisma = new PrismaClient();

// Define event types for type safety
export type AnalyticsEventType = 
  | 'summarize_success'    // When a successful summary is generated
  | 'pdf_upload'           // When a PDF is uploaded
  | 'linkurl_analysis'     // When a URL is analyzed
  | 'user_login'           // When a user logs in
  | 'llm_token_usage'      // Track token usage
  | 'user_registration'    // When a user registers
  | 'thread_created'       // When a new thread is created
  | 'vector_storage'       // When content is stored in vector DB
  | 'content_processing'   // When content is processed for summarization or retrieval
  | 'error_occurred';      // When an error occurs

interface TrackEventProps {
  eventType: AnalyticsEventType;
  userId?: number;
  messageId?: number;
  threadId?: number;
  properties?: Record<string, unknown>;
}

/**
 * Track an analytics event
 */
export async function trackEvent({
  eventType,
  userId,
  messageId,
  threadId,
  properties
}: TrackEventProps) {
  try {
    // Log to database
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        userId,
        messageId,
        threadId,
        properties: properties || {}
      }
    });
    
    console.log(`Analytics event tracked: ${eventType}`, { userId, messageId, threadId, properties });
    return true;
  } catch (error) {
    console.error('Failed to track analytics event:', error);
    return false;
  }
}

/**
 * Get analytics events with optional filtering and pagination
 */
export async function getAnalytics({
  eventType,
  startDate,
  endDate,
  limit = 10,
  page = 1
}: {
  eventType?: AnalyticsEventType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  page?: number;
}) {
  const where: Record<string, unknown> = {};
  
  if (eventType) {
    where.eventType = eventType;
  }
  
  if (startDate || endDate) {
    const createdAt: Record<string, Date> = {};
    if (startDate) createdAt.gte = startDate;
    if (endDate) createdAt.lte = endDate;
    where.createdAt = createdAt;
  }
  
  // Calculate total count for pagination
  const totalCount = await prisma.analyticsEvent.count({ where });
  
  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limit);
  const skip = (page - 1) * limit;
  
  // Get paginated data
  const events = await prisma.analyticsEvent.findMany({
    where,
    take: limit,
    skip,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      message: {
        select: {
          id: true,
          contentType: true,
          senderType: true
        }
      }
    }
  });
  
  return {
    events,
    pagination: {
      page,
      limit,
      totalItems: totalCount,
      totalPages
    }
  };
}

/**
 * Get token usage statistics over time
 */
export async function getTokenUsageStats(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const tokenEvents = await prisma.analyticsEvent.findMany({
    where: {
      eventType: 'llm_token_usage',
      createdAt: {
        gte: startDate
      }
    },
    select: {
      createdAt: true,
      properties: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
  
  // Group by date
  const dailyData: Record<string, {
    date: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedCount: number;
    requestCount: number;
  }> = {};
  
  tokenEvents.forEach(event => {
    const date = event.createdAt.toISOString().split('T')[0];
    const props = event.properties as Record<string, unknown>;
    
    if (!dailyData[date]) {
      dailyData[date] = {
        date,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cachedCount: 0,
        requestCount: 0
      };
    }
    
    dailyData[date].promptTokens += Number(props.promptTokens || 0);
    dailyData[date].completionTokens += Number(props.completionTokens || 0);
    dailyData[date].totalTokens += Number(props.totalTokens || 0);
    dailyData[date].cachedCount += props.cachedPromptTokens ? 1 : 0;
    dailyData[date].requestCount += 1;
  });
  
  return Object.values(dailyData);
}

/**
 * Get token usage per user
 */
export async function getUserTokenUsage(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const userEvents = await prisma.analyticsEvent.findMany({
    where: {
      eventType: 'llm_token_usage',
      createdAt: {
        gte: startDate
      },
      userId: {
        not: null
      }
    },
    select: {
      userId: true,
      properties: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });
  
  // Group by user
  const userData: Record<number, {
    userId: number;
    userName: string;
    totalTokens: number;
    requestCount: number;
  }> = {};
  
  userEvents.forEach(event => {
    if (!event.userId) return;
    
    const userId = event.userId;
    const props = event.properties as Record<string, unknown>;
    
    if (!userData[userId]) {
      userData[userId] = {
        userId,
        userName: event.user?.name || event.user?.email?.split('@')[0] || `User ${userId}`,
        totalTokens: 0,
        requestCount: 0
      };
    }
    
    userData[userId].totalTokens += Number(props.totalTokens || 0);
    userData[userId].requestCount += 1;
  });
  
  return Object.values(userData).sort((a, b) => b.totalTokens - a.totalTokens);
}

/**
 * Get analytics summary grouped by event type
 */
export async function getAnalyticsSummary(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const events = await prisma.analyticsEvent.groupBy({
    by: ['eventType'],
    _count: {
      id: true
    },
    where: {
      createdAt: {
        gte: startDate
      }
    }
  });
  
  return events.map(event => ({
    eventType: event.eventType,
    count: event._count.id
  }));
}

/**
 * Get daily analytics counts
 */
export async function getDailyAnalytics(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const events = await prisma.analyticsEvent.findMany({
    where: {
      createdAt: {
        gte: startDate
      }
    },
    select: {
      eventType: true,
      createdAt: true
    }
  });
  
  // Group by date and event type
  const dailyData: Record<string, Record<string, number>> = {};
  
  events.forEach((event: { eventType: string, createdAt: Date }) => {
    const date = event.createdAt.toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = {};
    }
    
    if (!dailyData[date][event.eventType]) {
      dailyData[date][event.eventType] = 0;
    }
    
    dailyData[date][event.eventType]++;
  });
  
  return Object.entries(dailyData).map(([date, events]) => ({
    date,
    ...events
  }));
} 