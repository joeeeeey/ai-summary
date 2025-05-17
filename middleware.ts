import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // The error you're encountering is due to the fact that the crypto module, which is used by jsonwebtoken for operations like jwt.verify, is not supported in the Edge Runtime of Next.js. The Edge Runtime is designed to be lightweight and fast, but it doesn't support all Node.js modules, including crypto.

import { jwtVerify } from 'jose';


export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  const { pathname } = request.nextUrl;

  // 定义需要身份验证的受保护路由
  const protectedRoutes = ['/dashboard', '/api/messages', '/api/threads'];

  // 路由需要未登录访问
  const guestRoutes = ['/login', '/register', '/'];

  // 检查 JWT
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      await jwtVerify(token, secret);
      // jwt.verify(token, process.env.JWT_SECRET!);

      // 已登录用户访问登录或注册页，重定向到 /dashboard
      if (guestRoutes.includes(pathname)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // 继续请求
      return NextResponse.next();
    } catch (error) {
      console.log('error: ', error);
      // 无效的 JWT，清除 Cookie 并重定向到 /login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.set('token', '', { maxAge: -1 });
      return response;
    }
  } else {
    // 未登录用户访问受保护的路由，重定向到 /login
    if (protectedRoutes.some((route) => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 允许访问非保护路由
    return NextResponse.next();
  }
}

// 应用中间件的匹配器
export const config = {
  matcher: ['/dashboard', '/api/:path*', '/login', '/register'],
};