import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { trackEvent } from '../../lib/analytics';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    // Track user login event
    try {
      await trackEvent({
        eventType: 'user_login',
        userId: user.id,
        properties: {
          email: user.email,
          loginTime: new Date().toISOString()
        }
      });
    } catch (trackingError) {
      // Log tracking error but continue with login
      console.error('Error tracking login event:', trackingError);
    }

    // Set HTTP-only cookie
    const response = NextResponse.json({ 
      message: 'Login successful.',
      success: true,
      userId: user.id 
    });
    
    response.cookies.set('token', token, { 
      httpOnly: true, 
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'  // Make sure cookie is available for all paths
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred during login. Please try again.' 
    }, { status: 500 });
  }
}