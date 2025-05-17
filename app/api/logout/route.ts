import { NextResponse } from 'next/server';

export async function POST() {
  // Create a response that clears the token cookie
  const response = NextResponse.json({ message: 'Logged out successfully' });
  
  // Remove the token cookie
  response.cookies.delete('token');
  
  return response;
}