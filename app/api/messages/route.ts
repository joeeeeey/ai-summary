import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import pdfParse from 'pdf-parse';
import { trackEvent } from '../../lib/analytics';

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
  linkUrl?: string;
}

// URL validation regex
const urlRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

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
    const thread = await prisma.thread.create({
      data: { userId },
    });
    
    // Track thread creation event
    await trackEvent({
      eventType: 'thread_created',
      userId,
      threadId: thread.id
    });
    
    return thread;
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

    const maxLength = 10000;
    if (pdfData.text.length > maxLength) {
      pdfData.text = pdfData.text.substring(0, maxLength) + '... (content truncated due to length)';
    }
    return {
      content: pdfData.text,
      fileName: file.name,
      fileSize: file.size
    };
  } catch (error) {
    console.error('PDF processing error:', error);
    
    // Track error event
    await trackEvent({
      eventType: 'error_occurred',
      properties: {
        errorType: 'pdf_processing',
        errorMessage: (error as Error).message
      }
    });
    
    throw new Error(`Failed to process PDF: ${(error as Error).message}`);
  }
}

// 5. New helper: Check if text is a URL
function isValidUrl(text: string): boolean {
  return urlRegex.test(text.trim());
}

// 6. New helper: Scrape web content
async function scrapeWebContent(url: string): Promise<string> {
  try {
    console.log('Scraping content from URL:', url);
    
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Fetch webpage content
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AISummaryBot/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Simple text extraction - in a production environment, use a proper HTML parser
    // This is a basic implementation that removes HTML tags and extracts text
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit content size
    const maxLength = 10000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '... (content truncated due to length)';
    }
    
    console.log(`Scraped ${text.length} characters from ${url}`);
    return text;
  } catch (error) {
    console.error('Web scraping error:', error);
    
    // Track error event
    await trackEvent({
      eventType: 'error_occurred',
      properties: {
        errorType: 'url_scraping',
        errorMessage: (error as Error).message,
        url
      }
    });
    
    throw new Error(`Failed to scrape web content: ${(error as Error).message}`);
  }
}

// 7. Message creation helper (updated with URL handling)
async function createMessageData(
  request: NextRequest,
  userId: number,
  thread: { id: number },
  requestBody: { content?: string } | null,
  formData: FormData | null
): Promise<{ userMessages: MessageData[] }> {
  
  const contentType = request.headers.get('content-type') || '';
  const userMessages: MessageData[] = [];
  
  console.log('Creating message data with content-type:', contentType);
  console.log('Form data available:', !!formData);
  
  // Check if we have form data
  if (contentType.includes('multipart/form-data') && formData) {
    // Handle PDF upload if present
    const file = formData.get('file') as File | null;
    if (file) {
      console.log('Processing PDF file:', file.name);
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
      
      // Track PDF upload event
      await trackEvent({
        eventType: 'pdf_upload',
        userId,
        threadId: thread.id,
        properties: {
          fileName,
          fileSize,
          contentLength: content.length
        }
      });
      
      console.log('Added PDF message to userMessages array');
    }
    
    // Handle text input if present
    const text = formData.get('text') as string | null;
    if (text && text.trim() !== '') {
      const trimmedText = text.trim();
      console.log('Processing text input:', trimmedText.substring(0, 50) + (trimmedText.length > 50 ? '...' : ''));
      
      // Check if the input is just a URL
      if (isValidUrl(trimmedText) && trimmedText.split(/\s+/).length === 1) {
        try {
          // Process as link type
          console.log('Detected URL input, processing as link');
          const scrapedContent = await scrapeWebContent(trimmedText);
          
          userMessages.push({
            threadId: thread.id,
            userId,
            senderType: 'user',
            contentType: 'link',
            content: scrapedContent,
            linkUrl: trimmedText
          });
          
          // Track link analysis event
          await trackEvent({
            eventType: 'linkurl_analysis',
            userId,
            threadId: thread.id,
            properties: {
              url: trimmedText,
              contentLength: scrapedContent.length
            }
          });
          
          console.log('Added link message with scraped content to userMessages array');
        } catch (error) {
          console.error('Failed to process URL:', error);
          // Fallback to treating as regular text if URL processing fails
          userMessages.push({
            threadId: thread.id,
            userId,
            senderType: 'user',
            contentType: 'text',
            content: `${trimmedText} (Note: Failed to load URL content: ${(error as Error).message})`,
            fileName: '',
          });
        }
      } else {
        // Process as regular text
        userMessages.push({
          threadId: thread.id,
          userId,
          senderType: 'user',
          contentType: 'text',
          content: trimmedText,
          fileName: '',
        });
        console.log('Added text message to userMessages array');
      }
    }
  } 
  // Handle legacy JSON request format
  else if (requestBody) {
    const { content } = requestBody;
    if (!content || content.trim() === '') {
      throw new Error('Content cannot be empty');
    }
    
    const trimmedContent = content.trim();
    
    // Check if the input is just a URL in JSON format too
    if (isValidUrl(trimmedContent) && trimmedContent.split(/\s+/).length === 1) {
      try {
        // Process as link type
        console.log('Detected URL input in JSON, processing as link');
        const scrapedContent = await scrapeWebContent(trimmedContent);
        
        userMessages.push({
          threadId: thread.id,
          userId,
          senderType: 'user',
          contentType: 'link',
          content: scrapedContent,
          linkUrl: trimmedContent
        });
      } catch (error) {
        // Fallback to treating as regular text
        userMessages.push({
          threadId: thread.id,
          userId,
          senderType: 'user',
          contentType: 'text',
          content: `${trimmedContent} (Note: Failed to load URL content: ${(error as Error).message})`,
          fileName: '',
        });
      }
    } else {
      // Regular text message
      userMessages.push({
        threadId: thread.id,
        userId,
        senderType: 'user',
        contentType: 'text',
        content: trimmedContent,
        fileName: '',
      });
    }
  }
  
  if (userMessages.length === 0) {
    throw new Error('No valid message content provided');
  }
  
  console.log('Total messages created:', userMessages.length);
  return { userMessages };
}

// 8. Format messages for AI processing
interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function formatMessagesForAI(messages: MessageData[]): AIMessage[] {
  return messages.map(msg => {
    if (msg.contentType === 'pdf') {
      return {
        role: 'user',
        content: "Here is the PDF content:\n\n" + msg.content,
      };
    } else if (msg.contentType === 'link') {
      return {
        role: 'user',
        content: `Here is content from the web page (${msg.linkUrl}):\n\n${msg.content}`,
      };
    } else {
      return {
        role: msg.senderType === 'user' ? 'user' : 'assistant',
        content: msg.content,
      };
    }
  });
}

// 9. Generate AI response
async function generateAIResponse(messages: AIMessage[]) {
  // Add the system prompt
  const messagesWithPrompt = [
    { role: "system", content: AI_SUMMARY_PROMPT },
    ...messages
  ];
  
  try {
    const { text, usage, providerMetadata } = await generateText({
      model: openai('gpt-4o'),
      messages: messagesWithPrompt,
    });
    
    console.log('Usage:', {
      ...usage,
      cachedPromptTokens: providerMetadata?.openai?.cachedPromptTokens,
    });
    
    // Track LLM token usage event
    await trackEvent({
      eventType: 'llm_token_usage',
      properties: {
        promptTokens: usage?.promptTokens || 0,
        completionTokens: usage?.completionTokens || 0,
        totalTokens: usage?.totalTokens || 0,
        model: 'gpt-4o',
        cachedPromptTokens: providerMetadata?.openai?.cachedPromptTokens || false
      }
    });
    
    return text;
  } catch (error) {
    console.error('AI generation error:', error);
    
    // Track error event
    await trackEvent({
      eventType: 'error_occurred',
      properties: {
        errorType: 'ai_generation',
        errorMessage: (error as Error).message
      }
    });
    
    throw new Error('Failed to generate AI response');
  }
}

// Main handler
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const userId = await authenticateUser(request);
    
    // 2. Parse request
    const { threadId, formData, requestBody } = await parseRequest(request);
    
    // 3. Get or create thread
    const thread = await getOrCreateThread(userId, threadId);
    
    // 4. Create user message(s)
    const { userMessages } = await createMessageData(request, userId, thread, requestBody, formData);
    
    // Save all user messages
    const savedUserMessages = [];
    for (const messageData of userMessages) {
      const message = await prisma.message.create({ data: messageData });
      savedUserMessages.push(message);
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
    const aiMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        userId,
        senderType: 'assistant',
        contentType: 'text',
        content: aiResponse,
      },
    });
    
    // Track successful summary event
    await trackEvent({
      eventType: 'summarize_success',
      userId,
      threadId: thread.id,
      messageId: aiMessage.id,
      properties: {
        messageType: userMessages[0]?.contentType || 'text',
        responseLength: aiResponse.length
      }
    });
    
    return NextResponse.json({ 
      message: 'Message sent.', 
      threadId: thread.id 
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Error:', error);
    
    // Track error event
    await trackEvent({
      eventType: 'error_occurred',
      properties: {
        errorType: 'api_error',
        errorMessage: error.message || 'Unknown error',
        errorStatus: error.status || 500
      }
    });
    
    // Structured error handling
    const status = error.status || 500;
    const message = error.message || 'Internal Server Error';
    
    return NextResponse.json({ error: message }, { status });
  }
}