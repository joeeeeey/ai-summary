import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { openai } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import pdfParse from 'pdf-parse';
import { trackEvent } from '../../lib/analytics';
import { storeDocumentChunks, retrieveRelevantContext } from '../../lib/vectorStore';

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
   - Judge the locale of the content and answer in the same language.

2. FOLLOW-UP INTERACTIONS:
   - For any subsequent interactions or questions, **do NOT** automatically provide a summary or bullet points unless explicitly requested.
   - Instead, answer precisely and directly, referencing the relevant information from the original content.
   - If the user's question is unclear, ask clarifying questions.
   - If the requested information is not found in the original content, respond with an apology and indicate the information was not present.

3. FORMAT:
   - Use Markdown formatting. 
   - Example for the **initial summary** output:
     """
The following is the summary for the [text/pdf/link] you provided:

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

5. WORKING WITH LARGE DOCUMENTS:
   - For large documents, only a summary is stored in the conversation history.
   - For follow-up questions about specific details, the system will automatically retrieve the most relevant sections.
   - Use this retrieved context to provide accurate answers, but acknowledge when information might be incomplete.
   - Only reference information present in the retrieved context or conversation history.
   - If relevant content isn't available in the retrieved context, mention this limitation to the user.

6. VECTOR RETRIEVAL:
   - When you see context labeled "Here are some relevant sections from the previously provided content", these are sections retrieved from the vector database based on the user's query.
   - Use this retrieved information to provide specific, accurate answers.
   - Be transparent about using retrieved information vs. information available in the conversation history.

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

    // We don't need to truncate anymore as we'll store in vector DB
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
    
    // No need to truncate anymore as we'll store in vector DB
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
      // set this message at first position
      userMessages.unshift({
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
  contentType?: string;
}

// Update the function to handle Prisma Message type
function formatMessagesForAI(messages: any[]): AIMessage[] {
  return messages.map(msg => {
    // Handle messages with hasFullContent=true (complete content in DB)
    if (msg.hasFullContent) {
      const contentType = msg.contentType;
      let contentPrefix = "";
      
      if (contentType === 'pdf') {
        contentPrefix = "Here is a summary of the PDF content (full content available via search):\n\n";
      } else if (contentType === 'link') {
        contentPrefix = `Here is a summary of the web page content from ${msg.linkUrl} (full content available via search):\n\n`;
      } else {
        contentPrefix = "Here is a summary of the content (full content available via search):\n\n";
      }
      
      return {
        role: 'user',
        content: contentPrefix + msg.content,
        contentType: msg.contentType
      };
    }
    // Handle messages with hasFullContent=false (truncated content, full content in vector DB)
    else if (msg.content.endsWith('...(truncated)')) {
      const contentType = msg.contentType;
      let contentPrefix = "";
      
      if (contentType === 'pdf') {
        contentPrefix = "Here is a truncated version of the PDF content (detailed parts will be retrieved on demand):\n\n";
      } else if (contentType === 'link') {
        contentPrefix = `Here is a truncated version of the web page content from ${msg.linkUrl} (detailed parts will be retrieved on demand):\n\n`;
      } else {
        contentPrefix = "Here is a truncated version of the content (detailed parts will be retrieved on demand):\n\n";
      }
      
      return {
        role: 'user',
        content: contentPrefix + msg.content,
        contentType: msg.contentType
      };
    }
    // Handle regular messages (not summarized, full content in DB)
    else {
      if (msg.contentType === 'pdf') {
        return {
          role: 'user',
          content: "Here is the PDF content:\n\n" + msg.content,
          contentType: 'pdf'
        };
      } 
      else if (msg.contentType === 'link') {
        return {
          role: 'user',
          content: `Here is content from the web page (${msg.linkUrl}):\n\n${msg.content}`,
          contentType: 'link'
        };
      } 
      else {
        return {
          role: msg.senderType === 'user' ? 'user' : 'assistant',
          content: msg.content,
          contentType: msg.contentType
        };
      }
    }
  });
}

// Updated to include context retrieval for AI processing
async function generateAIResponse(messages: AIMessage[], threadId: number, userId: number) {
  // Add the system prompt
  const messagesWithPrompt = [
    { role: "system", content: AI_SUMMARY_PROMPT },
    ...messages
  ];
  
  // Check if the last message is a user query that might need context
  const lastMessageIndex = messages.length - 1;
  const lastMessage = messages[lastMessageIndex];
  let retrievedContext = '';
  let retrievalMessageId: number | null = null;
  
  // Check if the thread already has messages with full content
  try {
    const threadMessages = await prisma.message.findMany({
      where: { 
        threadId: threadId,
        hasFullContent: true 
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // If there are messages with full content in the thread
    if (threadMessages.length > 0) {
      console.log(`Thread ${threadId} has ${threadMessages.length} messages with full content`);
      
      // Get the primary summary if it exists (for context)
      const primarySummary = threadMessages.find(msg => msg.summaryType === 'primary');
      
      if (primarySummary) {
        console.log('Thread contains primary summary, skipping vector retrieval');
        
        // Add a note to inform the AI that it's working with summarized content
        messagesWithPrompt.splice(1, 0, {
          role: 'system',
          content: 'Note: This thread contains summarized content from a longer text. Your response should be based on the summary as provided.'
        });
        
        // Track this decision for analytics
        await trackEvent({
          eventType: 'content_processing',
          userId,
          threadId,
          properties: {
            skipVectorRetrieval: true,
            reason: 'hasPrimarySummary',
            processingType: 'ai_response'
          }
        });
        
        // Skip vector retrieval
        return await processAIRequest(messagesWithPrompt, threadId, userId);
      }
    }
    
    // No primary summary found, try vector retrieval if appropriate
    if (lastMessage && lastMessage.role === 'user' && messages.length > 1) {
      try {
        // Get the actual messages from the database to find the message ID
        const dbMessages = await prisma.message.findMany({
          where: { threadId: threadId },
          orderBy: { createdAt: 'asc' },
        });
        
        // Get the last user message
        const lastUserMessage = dbMessages.length > 0 ? 
                               dbMessages[dbMessages.length - 1] : null;
        
        // Check if the last user message already has retrieved context
        if (lastUserMessage && lastUserMessage.retrievedContext) {
          console.log(`Using existing retrieved context from message ID: ${lastUserMessage.id}`);
          
          // Use existing retrieved context
          retrievedContext = lastUserMessage.retrievedContext;
          retrievalMessageId = lastUserMessage.id;
          
          // Append it to the last user message
          const contextPrefix = "\n\nRelevant context from previously provided content:\n\n";
          messagesWithPrompt[lastMessageIndex + 1].content += contextPrefix + retrievedContext;
          
          // Track reuse of context for analytics
          await trackEvent({
            eventType: 'content_processing',
            userId,
            threadId,
            properties: {
              retrievalType: 'reused',
              processingType: 'ai_response'
            }
          });
        } else {
          // Retrieve relevant context for the user's query
          console.log('Retrieving new context from vector database');
          const result = await retrieveRelevantContext(lastMessage.content, threadId, 4); // Increase to 4 chunks

          // Safely access properties with optional chaining
          const success = result?.success;
          const chunks = result?.chunks || 0;
          const context = result?.context || '';
          const errorMsg = 'error' in result ? result.error : '';

          if (success && chunks > 0 && context) {
            // Store retrieved context immediately
            retrievedContext = context;
            
            // Create a retrieval context message in the database immediately
            if (lastUserMessage && lastUserMessage.id) {
              await prisma.message.update({
                where: { id: lastUserMessage.id },
                data: { 
                  retrievedContext: context 
                }
              });
              retrievalMessageId = lastUserMessage.id;
              
              console.log(`Stored retrieved context with message ID: ${lastUserMessage.id}`);
            }
            
            // Instead of inserting a new system message, append the context to the last user message
            // This preserves the original message structure for prompt caching
            const contextPrefix = "\n\nRelevant context from previously provided content:\n\n";
            messagesWithPrompt[lastMessageIndex + 1].content += contextPrefix + context;
            
            console.log(`Appended ${chunks} context chunks to the last user message`);
          } else if (!success) {
            // Let the AI know we're working with limited context but without changing the message structure
            messagesWithPrompt[0].content += "\n\nNote: The vector storage system is currently unavailable. Your response should be based only on the content visible in this conversation, which may be truncated for large documents.";
            
            console.log('Vector retrieval failed, adding warning to system prompt');
            
            // Track error for monitoring
            await trackEvent({
              eventType: 'error_occurred',
              userId,
              threadId,
              properties: {
                errorType: 'vector_retrieval_failed',
                errorMessage: errorMsg || 'Unknown error'
              }
            });
          }
        }
      } catch (error) {
        console.error('Error retrieving context:', error);
        // Continue without context if retrieval fails
      }
    }
  } catch (error) {
    console.error('Error checking thread messages:', error);
    // Continue without context if there's an error
  }
  
  // Process the AI request with the prepared messages and include retrieved context
  return await processAIRequest(messagesWithPrompt, threadId, userId, retrievedContext, retrievalMessageId);
}

// Helper function to process the AI request with prepared messages
async function processAIRequest(
  messagesWithPrompt: any[], 
  threadId: number, 
  userId: number, 
  retrievedContext: string = '',
  retrievalMessageId: number | null = null
) {
  try {
    console.log('messagesWithPrompt: ', messagesWithPrompt);
    const result = streamText({
      model: openai('gpt-4o'),
      messages: messagesWithPrompt as any,
      onError: async ({ error }) => {
        console.error('Streaming error:', error);
        
        // Update thread status to failed
        await prisma.thread.update({
          where: { id: threadId },
          data: { status: "failed" }
        });
        
        // Track error event
        await trackEvent({
          eventType: 'error_occurred',
          userId,
          threadId,
          properties: {
            errorType: 'ai_generation',
            errorMessage: (error as Error).message,
            hasRetrievedContext: retrievedContext.length > 0
          }
        });
      },
      onFinish: async ({ text, usage, providerMetadata }) => {
        console.log('Usage:', {
          ...usage,
          cachedPromptTokens: providerMetadata?.openai?.cachedPromptTokens,
        });
        
        // Track LLM token usage event
        await trackEvent({
          eventType: 'llm_token_usage',
          userId,
          threadId,
          properties: {
            promptTokens: usage?.promptTokens || 0,
            completionTokens: usage?.completionTokens || 0,
            totalTokens: usage?.totalTokens || 0,
            model: 'gpt-4o',
            cachedPromptTokens: providerMetadata?.openai?.cachedPromptTokens || false,
            usedRetrievedContext: retrievedContext.length > 0
          }
        });
        
        // Update thread status to success
        await prisma.thread.update({
          where: { id: threadId },
          data: { status: "success" }
        });
        
        // Save the complete AI response
        await prisma.message.create({
          data: {
            threadId,
            userId,
            senderType: 'assistant',
            contentType: 'text',
            content: text,
            retrievedContext: retrievedContext, // Also store the retrieved context with the AI response
            retrievalMessageId: retrievalMessageId // Link to the message that had the retrieval
          },
        });
        
        // Track successful summary event
        await trackEvent({
          eventType: 'summarize_success',
          userId,
          threadId,
          properties: {
            messageType: messagesWithPrompt[messagesWithPrompt.length - 2]?.contentType || 'text', // Last user message (account for system prompt)
            responseLength: text.length,
            usedRetrievedContext: retrievedContext.length > 0
          }
        });
      }
    });
    
    return result;
  } catch (error) {
    console.error('AI generation error:', error);
    
    // Update thread status to failed
    await prisma.thread.update({
      where: { id: threadId },
      data: { status: "failed" }
    });
    
    // Track error event
    await trackEvent({
      eventType: 'error_occurred',
      userId,
      threadId,
      properties: {
        errorType: 'ai_generation',
        errorMessage: (error as Error).message,
        hasRetrievedContext: retrievedContext.length > 0
      }
    });
    
    throw new Error('Failed to generate AI response');
  }
}

// Add a new route for retry functionality
export async function PUT(request: NextRequest) {
  try {
    // 1. Authenticate user
    const userId = await authenticateUser(request);
    
    // 2. Get threadId from request
    const { threadId } = await request.json();
    
    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }
    
    // 3. Verify the thread belongs to the user and has failed status
    const thread = await prisma.thread.findFirst({
      where: { 
        id: threadId,
        userId
      },
    });
    
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    
    // 4. Get all messages in thread
    const allMessages = await prisma.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
    });
    
    if (allMessages.length === 0) {
      return NextResponse.json({ error: 'No messages found in this thread' }, { status: 400 });
    }
    
    // 5. Check if the last message is from the assistant
    // If yes, delete it since we're going to retry and generate a new response
    const lastMessage = allMessages[allMessages.length - 1];
    if (lastMessage.senderType === 'assistant') {
      await prisma.message.delete({
        where: { id: lastMessage.id }
      });
      
      // Remove the last message from the array as well
      allMessages.pop();
    }
    
    // 6. Check if the last user message already has retrieved context
    const lastUserMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;
    let hasRetrievedContext = false;
    
    if (lastUserMessage && lastUserMessage.retrievedContext) {
      hasRetrievedContext = true;
      console.log(`Retry will reuse retrieved context from message ID: ${lastUserMessage.id}`);
      
      // Track reuse of context for analytics
      await trackEvent({
        eventType: 'content_processing',
        userId,
        threadId,
        properties: {
          retrievalType: 'reused_on_retry',
          processingType: 'ai_response'
        }
      });
    }
    
    // 7. Format messages for AI
    const formattedMessages = formatMessagesForAI(allMessages);
    
    // 8. Generate AI response with streaming
    try {
      // Get the streamText result
      const stream = await generateAIResponse(formattedMessages, thread.id, userId);
      
      // Return streaming response with thread ID in headers
      const response = stream.toTextStreamResponse();
      response.headers.set('x-thread-id', thread.id.toString());
      response.headers.set('x-has-retrieved-context', hasRetrievedContext.toString());
      return response;
    } catch (error) {
      // If AI generation fails, we return error
      return NextResponse.json({ 
        error: 'Failed to generate AI response',
        threadId: thread.id,
        hasRetrievedContext
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error during retry:', error);
    
    // Track error event
    await trackEvent({
      eventType: 'error_occurred',
      properties: {
        errorType: 'retry_api_error',
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

// Update the POST handler to store content in vector DB
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
    // update thread.title by the first message content and trim 5, and with '-' + thread.id
    thread.title = userMessages[0].content.trim().substring(0, 20);
    await prisma.thread.update({
      where: { id: thread.id },
      data: { title: thread.title },
    });

    // Save all user messages
    const savedUserMessages = [];
    const CONTENT_MAX_LENGTH = 12000; // Maximum length that can be stored in the database field
    const TEXT_SUMMARY_THRESHOLD = 3000; // Threshold to mark text content as summary-worthy
    
    for (const messageData of userMessages) {
      // Check if content exceeds database field length limit
      const isLongContent = messageData.content.length > CONTENT_MAX_LENGTH;
      
      // Check if text content is long enough to be considered for summary but below DB limit
      const isTextSummaryContent = messageData.contentType === 'text' && 
                                  messageData.content.length > TEXT_SUMMARY_THRESHOLD && 
                                  messageData.content.length <= CONTENT_MAX_LENGTH;
      
      // PDF and link content should always be marked with hasFullContent regardless of size
      const isPdfOrLink = messageData.contentType === 'pdf' || messageData.contentType === 'link';
      
      if (isLongContent) {
        // Create database record version for long content
        const dbMessageData = {
          ...messageData,
          content: messageData.content.substring(0, CONTENT_MAX_LENGTH - 100) + '...(truncated)',
          hasFullContent: false, // This content is truncated, so hasFullContent should be false
          summaryType: 'primary' // Mark as the primary summary for the thread
        };
        
        // Save message summary to database
        const message = await prisma.message.create({ data: dbMessageData });
        savedUserMessages.push(message);
        
        // Save full content to vector database
        await storeDocumentChunks(messageData.content, {
          threadId: message.threadId,
          messageId: message.id,
          contentType: message.contentType,
          userId: userId
        });
        
        // Record vector storage event
        await trackEvent({
          eventType: 'vector_storage',
          userId: userId,
          threadId: message.threadId,
          messageId: message.id,
          properties: {
            contentType: message.contentType,
            contentLength: messageData.content.length
          }
        });
      } else if (isTextSummaryContent || isPdfOrLink) {
        // For text content that's long enough to be summarized but doesn't exceed DB limits
        // OR for PDF and link content that should always be marked with hasFullContent
        
        // Check if this thread already has a primary summary
        const existingSummaries = await prisma.message.findMany({
          where: {
            threadId: messageData.threadId,
            hasFullContent: true
          }
        });

        // Determine the summary type based on existing summaries and content type
        // PDF and link content should always be primary if they are the first summary in the thread
        const summaryType = existingSummaries.length === 0 ? 'primary' : 'additional';
        
        const message = await prisma.message.create({ 
          data: {
            ...messageData,
            hasFullContent: true, // Not truncated, full content is in the DB
            summaryType
          }
        });
        savedUserMessages.push(message);
        
        // Track event for content processing
        await trackEvent({
          eventType: 'content_processing',
          userId: userId,
          threadId: message.threadId,
          messageId: message.id,
          properties: {
            contentType: messageData.contentType,
            contentLength: messageData.content.length,
            processingType: 'summary',
            summaryType
          }
        });
      } else {
        // Regular content saved directly - not summarized, not truncated
        const message = await prisma.message.create({ data: messageData });
        savedUserMessages.push(message);
      }
    }
    
    // 5. Get all messages in thread
    const allMessages = await prisma.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
    });
    
    // 6. Format messages for AI
    const formattedMessages = formatMessagesForAI(allMessages);
    
    // 7. Generate AI response with streaming
    try {
      const stream = await generateAIResponse(formattedMessages, thread.id, userId);
      
      // Create streaming response with thread ID in headers
      const response = stream.toTextStreamResponse();
      response.headers.set('x-thread-id', thread.id.toString());
      return response;
    } catch (error) {
      // If AI generation fails, we still return success but with a flag indicating failure
      // The UI will show the retry button
      return NextResponse.json({ 
        message: 'Message sent but AI processing failed. You can retry.', 
        threadId: thread.id,
        aiError: true
      }, { status: 201 });
    }
    
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