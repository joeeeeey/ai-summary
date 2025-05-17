import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { 
  getAnalytics, 
  getAnalyticsSummary, 
  getDailyAnalytics, 
  getTokenUsageStats,
  getUserTokenUsage
} from '../../lib/analytics';

// Admin authentication middleware
async function authenticateAdmin(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      throw { status: 401, message: 'Unauthorized' };
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    
    // In a real application, you would check if the user has admin privileges
    // For simplicity, we're assuming all authenticated users can access analytics
    return decoded.userId;
  } catch (error) {
    console.error('Authentication error:', error);
    throw { status: 401, message: 'Unauthorized' };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate the user
    await authenticateAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'events';
    const days = parseInt(searchParams.get('days') || '30', 10);
    const eventType = searchParams.get('eventType') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    
    // Set start date based on days parameter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let data;
    
    // Return different data based on the requested type
    switch (type) {
      case 'summary':
        data = await getAnalyticsSummary(days);
        break;
      case 'daily':
        data = await getDailyAnalytics(days);
        break;
      case 'token-usage':
        data = await getTokenUsageStats(days);
        break;
      case 'user-token-usage':
        data = await getUserTokenUsage(days);
        break;
      case 'events':
      default:
        data = await getAnalytics({
          eventType: eventType as string | undefined,
          startDate,
          limit,
          page
        });
        break;
    }
    
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Analytics API error:', error);
    
    const status = (error as { status?: number })?.status || 500;
    const message = (error as { message?: string })?.message || 'Internal Server Error';
    
    return NextResponse.json({ error: message }, { status });
  }
} 