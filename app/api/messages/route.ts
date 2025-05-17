import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const prisma = new PrismaClient();

// const result = streamText({
//   model: openai('gpt-4-turbo'),
//   system: 'You are a helpful assistant.',
//   messages,
// });

// generateText: Generates text for a given prompt and model.
// streamText: Streams text from a given prompt and model.


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
        contentType: 'text', // should be check by another method, it could be pdf
        content,
      },
    });

    /**
     * 
     * [{
        role: 'user',
        content: [
          {
            type: 'file',
            data: fs.readFileSync('./data/ai.pdf'),
            mimeType: 'application/pdf',
            filename: 'ai.pdf', // optional
          },
        ],
      },
      {
        "role": "assistant",
        "content": "Hello! How can I assist you today?"
      },
      ]
     * 
     */

    // messages = []
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
        const fileData = fs.readFileSync(`./data/${msg.content}`); // Adjust the path as needed
        return {
          role: msg.senderType === 'user' ? 'user' : 'assistant',
          content: [
            {
              type: 'file',
              data: fileData,
              mimeType: 'application/pdf',
              filename: msg.content, // Assuming the content field stores the filename
            },
          ],
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