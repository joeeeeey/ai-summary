import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// handle message create, it is the core function, currently we only get a stub
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const userId = decoded.userId;

    const request_body = await request.json()
    console.log('request_body: ', request_body);
    const { content } = request_body;

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Content cannot be empty.' }, { status: 400 });
    }

    // 检查是否有线程ID，如果没有，则创建新线程
    const { threadId } = request_body;

    let thread;

    if (threadId) {
      // 检查线程是否属于当前用户
      thread = await prisma.thread.findFirst({
        where: {
          id: threadId,
          userId,
        },
      });

      if (!thread) {
        return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
      }
    } else {
      // 创建新线程
      thread = await prisma.thread.create({
        data: {
          userId,
        },
      });
    }

    // 创建新消息
    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        userId,
        senderType: 'user',
        contentType: 'text', // should be check by another method
        content,
      },
    });

    // 暂时不调用 LLM，只返回成功响应
    return NextResponse.json({ message: 'Message sent.', threadId: thread.id }, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}