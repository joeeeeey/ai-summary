import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const userId = decoded.userId;

    const threads = await prisma.thread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ threads }, { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const userId = decoded.userId;

    // 处理表单数据
    const formData = await request.formData();
    const content = formData.get('content')?.toString() || '';
    const contentType = formData.get('contentType')?.toString() || 'text';
    
    // 创建新线程
    const thread = await prisma.thread.create({
      data: {
        userId,
        title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      },
    });

    // 添加用户消息
    await prisma.message.create({
      data: {
        threadId: thread.id,
        userId,
        senderType: 'user',
        contentType,
        content,
        // 如果是PDF文件,处理文件上传
        fileName: contentType === 'pdf' ? formData.get('fileName')?.toString() : undefined,
        // 处理其他可能的字段...
      },
    });

    // 可能需要添加AI响应消息的逻辑

    return NextResponse.json({ threadId: thread.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating thread:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}