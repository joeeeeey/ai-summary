import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // The error you're encountering is due to the fact that the crypto module, which is used by jsonwebtoken for operations like jwt.verify, is not supported in the Edge Runtime of Next.js. The Edge Runtime is designed to be lightweight and fast, but it doesn't support all Node.js modules, including crypto.

import { jwtVerify } from 'jose';


export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname, search } = request.nextUrl;

  // Redirect dashboard to home page
  if (pathname === '/dashboard') {
    const url = new URL('/', request.url);
    // Copy all query parameters
    if (search) {
      url.search = search;
    }
    return NextResponse.redirect(url);
  }

  // Define protected routes that require authentication
  const protectedRoutes = ['/', '/dashboard', '/api/messages', '/api/threads'];

  // Routes that should be accessible without authentication
  const guestRoutes = ['/login', '/register', '/api/login', '/api/register'];

  // Check if the current route is an auth-related API route that should always be accessible
  if (pathname === '/api/login' || pathname === '/api/register') {
    return NextResponse.next();
  }

  // Check JWT token
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      await jwtVerify(token, secret);
      // jwt.verify(token, process.env.JWT_SECRET!);

      // Redirect logged-in users from login/register to home page
      if (guestRoutes.includes(pathname)) {
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Continue with the request
      return NextResponse.next();
    } catch (error) {
      console.log('error: ', error);
      // Invalid JWT, clear cookie and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.set('token', '', { maxAge: -1 });
      return response;
    }
  } else {
    // For unauthenticated users:
    // 1. Allow access to guest routes (login/register)
    if (guestRoutes.includes(pathname)) {
      return NextResponse.next();
    }
    
    // 2. Redirect unauthenticated users trying to access protected routes to login
    if (protectedRoutes.some((route) => pathname === route || pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Allow access to other non-protected routes
    return NextResponse.next();
  }
}

// Apply middleware to these routes
export const config = {
  matcher: ['/', '/dashboard', '/api/:path*', '/login', '/register'],
};