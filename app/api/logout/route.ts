import { NextResponse } from 'next/server';

export async function POST() {
  // 清除 Cookie
  const response = NextResponse.json({ message: 'Logged out successfully.' });
  response.cookies.set('token', '', { maxAge: -1 });
  return response;
}