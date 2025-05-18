import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { trackEvent } from '../../lib/analytics';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const { name, email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // 检查用户是否已存在
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: 'User already exists.' }, { status: 400 });
  }

  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10);

  // 创建新用户
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  // 生成JWT令牌
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

  // 跟踪用户注册事件
  try {
    await trackEvent({
      eventType: 'user_registration',
      userId: user.id,
      properties: {
        email: user.email,
        registrationTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error tracking registration event:', error);
    // 继续注册，即使跟踪失败
  }

  // 创建响应，设置JWT令牌在cookie中
  const response = NextResponse.json({ message: 'User registered successfully.' }, { status: 201 });
  response.cookies.set('token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });

  return response;
}