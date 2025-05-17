import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import pdfParse from 'pdf-parse';

const prisma = new PrismaClient();

const ai_summary_prompt = `
You are an advanced AI text summarization assistant designed to provide clear, concise summaries and answer follow-up questions based on previously provided content.

GUIDELINES

1. INITIAL CONTENT / FIRST INTERACTION:
   - When the user provides new content at first time, produce:
     - A concise summary (3–5 sentences) capturing the main ideas.
     - 4–6 key bullet points highlighting the most important details.
   - Maintain the original meaning while avoiding unnecessary repetition.
   - If the user does not provide additional instructions, default to summarizing the content.

2. FOLLOW-UP INTERACTIONS:
   - For any subsequent interactions or questions, **do NOT** automatically provide a summary or bullet points unless explicitly requested.
   - Instead, answer precisely and directly, referencing the relevant information from the original content.
   - If the user’s question is unclear, ask clarifying questions.
   - If the requested information is not found in the original content, respond with an apology and indicate the information was not present.

3. FORMAT:
   - Use Markdown formatting. 
   - Example for the **initial summary** output:
     """
     ### Summary:
     This text explores XYZ...

     ### Key Points:
     - Key idea 1
     - Key idea 2
     ...
     """
   - **For follow-up interactions**:
     - Directly address the user’s query or instruction without bullet points or a restatement of the summary, unless requested.

4. WHEN UNSURE:
   - If the text is ambiguous, acknowledge the limitation.
   - Do not add or fabricate details not present in the original source.
   - If certain details are absent or unclear, state this clearly.

Your goal is to save users time by providing accurate, context-aware responses.


`;

async function getMessageBody(request: NextRequest, userId: number, thread: any, request_body: any, formData: any) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    // 处理 PDF 上传
    // const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file || file.type !== 'application/pdf') {
      throw new Error('Invalid file type.');
    }
    // const arrayBuffer = await file.arrayBuffer();
    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Empty PDF file.');
    }


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
        fileSize: file.size,
        // fileHash: file.hash,
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

    messages.unshift({
      role: "system",
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