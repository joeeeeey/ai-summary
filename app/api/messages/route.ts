import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import pdfParse from 'pdf-parse';

const prisma = new PrismaClient();


async function getMessageBody(request: NextRequest, userId: number, thread: any, request_body: any, formData: any) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    // 处理 PDF 上传
    // const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file || file.type !== 'application/pdf') {
      throw new Error('Invalid file type.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    const content = pdfData.text;
    return {
      data: {
        threadId: thread.id,
        userId,
        senderType: 'user',
        contentType: 'pdf',
        content, // PDF 解析后的文本
        fileName: file.name,
      },
    };
  } else {
    // 处理文本消息
    // const request_body = await request.json();
    const { content } = request_body;
    if (!content || content.trim() === '') {
      throw new Error('Content cannot be empty.');
    }
    return {
      data: {
        threadId: thread.id,
        userId,
        senderType: 'user',
        contentType: 'text',
        content,
      },
    };
  }
}

// handle message create, it is the core function, currently we only get a stub
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const userId = decoded.userId;
    // 先判断 threadId
    let thread;
    let threadId: number | undefined;

    let request_body;
    let formData


    // 先判断 content-type
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
      console.log('formData: ', formData);
      threadId = formData.get('threadId') ? Number(formData.get('threadId')) : undefined;
      console.log('threadId: ', threadId);
    } else {
      request_body = await request.json();
      threadId = request_body.threadId;
    }


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

    const message_body = await getMessageBody(request, userId, thread, request_body, formData);

    // 创建新消息
    await prisma.message.create(message_body);

    // Fetch all messages from the current thread and sort by createdAt
    const allMessages = await prisma.message.findMany({
      where: {
        threadId: thread.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Map the messages into the desired format
    const messages = allMessages.map((msg) => {
      if (msg.contentType === 'pdf') {
        // Assuming you have a way to read the file content, e.g., from a file system or a storage service
        // const fileData = fs.readFileSync(`./data/${msg.content}`); // Adjust the path as needed
        return {
          role: 'user',
          content: "Here is the PDF content:\n\n" + msg.content,
        };
      } else {
        return {
          role: msg.senderType === 'user' ? 'user' : 'assistant',
          content: msg.content,
        };
      }
    });

    const ai_summary_prompt = `You are an advanced AI text summarization assistant designed to provide clear, concise summaries of content. Follow these instructions for each request:

1. INITIAL SUMMARY:
   - When provided with text, create a concise summary (3-5 sentences) capturing the main ideas
   - Extract and list 4-6 key bullet points highlighting the most important information
   - Maintain the original meaning while eliminating redundancy

2. FOLLOW-UP INTERACTIONS:
   - For follow-up questions, provide more precise analysis based on the original content
   - Adjust summary length and detail based on user requests (shorter/longer summaries)
   - If asked for specific information from the text, extract and present it clearly
   - When requested, provide different perspectives or alternative interpretations

3. FORMATTING:
   - All response should use markdown raw string
   here is an example of output:
   """
### Summary:

Summary sentence

### Key Points:

- k1
- k2
- k3
  """

4. LIMITATIONS:
   - If the text is ambiguous, acknowledge limitations in your summary
   - Do not add information not present in the original text
   - When uncertain about specific details, indicate this clearly

Your goal is to save users time by distilling complex information into essential insights while preserving accuracy and context.`

    messages.unshift({
      role: "assistant",
      content: ai_summary_prompt,
    });


    // console.log('messages: ', messages);

    const { text, usage, providerMetadata } = await generateText({
      model: openai('gpt-4o'),
      messages,
    });

    console.log('text: ', text);
    
    console.log(`usage:`, {
      ...usage,
      cachedPromptTokens: providerMetadata?.openai?.cachedPromptTokens,
    });
    
    // console.log('result: ', text);

    await prisma.message.create({
      data: {
        threadId: thread.id,
        userId,
        senderType: 'assistant',
        contentType: 'text', // should be check by another method, it could be pdf
        content: text,
      },
    });

    return NextResponse.json({ message: 'Message sent.', threadId: thread.id }, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}