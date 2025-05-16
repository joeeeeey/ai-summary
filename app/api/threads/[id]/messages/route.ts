import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const userId = decoded.userId;
    const threadId = parseInt(params.id);

    // 检查线程是否属于当前用户
    const thread = await prisma.thread.findFirst({
      where: {
        id: threadId,
        userId,
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
    }

    // 获取消息
    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}