import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import pdfParse from 'pdf-parse';

const prisma = new PrismaClient();

// AI summary prompt
const AI_SUMMARY_PROMPT = `
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
   - If the user's question is unclear, ask clarifying questions.
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
     - Directly address the user's query or instruction without bullet points or a restatement of the summary, unless requested.

4. WHEN UNSURE:
   - If the text is ambiguous, acknowledge the limitation.
   - Do not add or fabricate details not present in the original source.
   - If certain details are absent or unclear, state this clearly.

Your goal is to save users time by providing accurate, context-aware responses.


`;

// Types for better code organization
interface MessageData {
  threadId: number;
  userId: number;
  senderType: string;
  contentType: string;
  content: string;
  fileName?: string;
  fileSize?: number;
}

// 1. Authentication helper
async function authenticateUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  
  if (!token) {
    throw { status: 401, message: 'Unauthorized' };
  }
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
  return decoded.userId;
}

// 2. Request parsing helper
async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  let threadId: number | undefined;
  let formData = null;
  let requestBody = null;
  
  try {
    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
      console.log('Form data keys:', [...formData.keys()]);
      threadId = formData.get('threadId') ? Number(formData.get('threadId')) : undefined;
    } else {
      requestBody = await request.json();
      threadId = requestBody.threadId;
    }
    
    return { threadId, formData, requestBody, contentType };
  } catch (error) {
    console.error('Request parsing error:', error);
    throw { status: 400, message: 'Invalid request format' };
  }
}

// 3. Thread management helper
async function getOrCreateThread(userId: number, threadId?: number) {
  if (threadId) {
    const thread = await prisma.thread.findFirst({
      where: { id: threadId, userId },
    });
    
    if (!thread) {
      throw { status: 404, message: 'Thread not found' };
    }
    
    return thread;
  } else {
    return await prisma.thread.create({
      data: { userId },
    });
  }
}

// 4. PDF processing helper
async function processPdfContent(file: File): Promise<{ content: string, fileName: string, fileSize: number }> {
  try {
    if (!file || file.type !== 'application/pdf') {
      throw new Error('Invalid file type');
    }
    
    console.log('Processing PDF:', file.name, file.size);
    
    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Empty PDF file');
    }
    
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    
    return {
      content: pdfData.text,
      fileName: file.name,
      fileSize: file.size
    };
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error(`Failed to process PDF: ${(error as Error).message}`);
  }
}

// 5. Message creation helper
async function createMessageData(
  request: NextRequest,
  userId: number,
  thread: any,
  requestBody: any,
  formData: FormData | null
): Promise<{ userMessages: MessageData[] }> {
  
  const contentType = request.headers.get('content-type') || '';
  const userMessages: MessageData[] = [];
  
  // Check if we have form data
  if (contentType.includes('multipart/form-data') && formData) {
    // Handle PDF upload if present
    const file = formData.get('file') as File | null;
    if (file) {
      const { content, fileName, fileSize } = await processPdfContent(file);
      
      userMessages.push({
        threadId: thread.id,
        userId,
        senderType: 'user',
        contentType: 'pdf',
        content,
        fileName,
        fileSize
      });
    }
    
    // Handle text input if present
    const text = formData.get('text') as string | null;
    if (text && text.trim() !== '') {
      userMessages.push({
        threadId: thread.id,
        userId,
        senderType: 'user',
        contentType: 'text',
        content: text,
        fileName: '',
      });
    }
  } 
  // Handle legacy JSON request format
  else if (requestBody) {
    const { content } = requestBody;
    if (!content || content.trim() === '') {
      throw new Error('Content cannot be empty');
    }
    
    userMessages.push({
      threadId: thread.id,
      userId,
      senderType: 'user',
      contentType: 'text',
      content,
      fileName: '',
    });
  }
  
  if (userMessages.length === 0) {
    throw new Error('No valid message content provided');
  }
  
  return { userMessages };
}

// 6. Format messages for AI processing
function formatMessagesForAI(messages: any[]) {
  return messages.map(msg => {
    if (msg.contentType === 'pdf') {
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
}

// 7. Generate AI response
async function generateAIResponse(messages: any[]) {
  // Add the system prompt
  const messagesWithPrompt = [
    { role: "system", content: AI_SUMMARY_PROMPT },
    ...messages
  ];
  
  try {
    const { text, usage, providerMetadata } = await generateText({
      model: openai('gpt-4o'),
      // @ts-ignore - Type issue with the messages format
      messages: messagesWithPrompt,
    });
    
    console.log('Usage:', {
      ...usage,
      cachedPromptTokens: providerMetadata?.openai?.cachedPromptTokens,
    });
    
    return text;
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error('Failed to generate AI response');
  }
}

// Main handler
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const userId = await authenticateUser(request);
    
    // 2. Parse request
    const { threadId, formData, requestBody, contentType } = await parseRequest(request);
    
    // 3. Get or create thread
    const thread = await getOrCreateThread(userId, threadId);
    
    // 4. Create user message(s)
    const { userMessages } = await createMessageData(request, userId, thread, requestBody, formData);
    
    // Save all user messages
    for (const messageData of userMessages) {
      await prisma.message.create({ data: messageData });
    }
    
    // 5. Get all messages in thread
    const allMessages = await prisma.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
    });
    
    // 6. Format messages for AI
    const formattedMessages = formatMessagesForAI(allMessages);
    
    // 7. Generate AI response
    const aiResponse = await generateAIResponse(formattedMessages);
    
    // 8. Save AI response
    await prisma.message.create({
      data: {
        threadId: thread.id,
        userId,
        senderType: 'assistant',
        contentType: 'text',
        content: aiResponse,
      },
    });
    
    return NextResponse.json({ 
      message: 'Message sent.', 
      threadId: thread.id 
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Error:', error);
    
    // Structured error handling
    const status = error.status || 500;
    const message = error.message || 'Internal Server Error';
    
    return NextResponse.json({ error: message }, { status });
  }
}