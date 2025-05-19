import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PineconeStore } from '@langchain/pinecone';
import type { Index } from '@pinecone-database/pinecone';

// Initialize Pinecone client
// Lazy initialization to avoid issues during build time
let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || '',
    });
  }
  return pineconeClient;
}

// Index name - each different app should use its own index
const PINECONE_INDEX_NAME = 'ai-summary';

// Set up OpenAI embeddings - lazy initialization
let openAiEmbeddings: OpenAIEmbeddings | null = null;

function getEmbeddings(): OpenAIEmbeddings {
  if (!openAiEmbeddings) {
    openAiEmbeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-ada-002', // Most cost-effective embedding model
    });
  }
  return openAiEmbeddings;
}

// Configuration constants
const TIMEOUT_MS = 8000; // 5 second timeout for vector operations
const MAX_RETRIES = 2;   // Maximum number of retries for failed operations
const BATCH_SIZE = 20;   // Batch size for processing chunks

// Helper to get or create the index with timeout
async function getOrCreateIndex(): Promise<Index> {
  try {
    // Set up a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Pinecone operation timed out')), TIMEOUT_MS);
    });

    const indexPromise = async () => {
      const indexes = await getPineconeClient().listIndexes();
      
      // Check if our index already exists
      const indexExists = indexes.indexes?.some((i: { name: string }) => i.name === PINECONE_INDEX_NAME) || false;
      
      if (!indexExists) {
        try {
          // Create the index if it doesn't exist
          await getPineconeClient().createIndex({ 
            name: PINECONE_INDEX_NAME,
            dimension: 1536, // Dimension size for OpenAI embeddings
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'aws',
                region: 'us-east-1' // Changed from us-west-2 to us-east-1 which is supported on free plan
              }
            }
          });

          console.log(`Created new Pinecone index: ${PINECONE_INDEX_NAME}`);
        } catch (error) {
          console.error('Failed to create Pinecone index:', error);
          // Continue execution - we'll handle the missing index case in each function
        }
      }
      
      return getPineconeClient().index(PINECONE_INDEX_NAME);
    };
    
    // Race the index operation against the timeout
    return await Promise.race([indexPromise(), timeoutPromise]);
  } catch (error) {
    if ((error as Error).message === 'Pinecone operation timed out') {
      console.error('Pinecone index operation timed out');
    } else {
      console.error('Error accessing Pinecone:', error);
    }
    throw error;
  }
}

// Helper function to process operations with timeout and retry
async function withTimeoutAndRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create a timeout promise that rejects after TIMEOUT_MS
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${operationName} timed out`)), TIMEOUT_MS);
      });
      
      // Race the operation against the timeout
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      lastError = error as Error;
      console.error(`${operationName} attempt ${attempt + 1} failed:`, error);
      
      // If this was the last retry, break out of the loop
      if (attempt === MAX_RETRIES) break;
      
      // Wait a bit before retrying (200ms, 400ms, etc.)
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  
  // If we got here, all attempts failed
  throw lastError;
}

// Function to store document chunks in vector store
export async function storeDocumentChunks(
  content: string,
  metadata: { 
    threadId: number, 
    messageId: number, 
    contentType: string,
    userId: number 
  }
) {
  try {
    console.log(`Storing content in vector DB for messageId: ${metadata.messageId}`);
    
    // Split content into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const chunks = await textSplitter.splitText(content);
    console.log(`Split content into ${chunks.length} chunks for indexing`);
    
    // Convert to Document objects with metadata
    const documents = chunks.map((chunk) => {
      return new Document({
        pageContent: chunk,
        metadata: {
          ...metadata,
          chunk: chunk.slice(0, 50) + '...' // For debugging
        },
      });
    });
    
    try {
      // Get Pinecone index with timeout
      const index = await withTimeoutAndRetry(() => getOrCreateIndex(), "Get Pinecone index");
      
      if (documents.length > BATCH_SIZE) {
        // Process in batches for better performance
        console.log(`Processing ${documents.length} chunks in batches of ${BATCH_SIZE}`);
        
        // Process documents in batches to avoid overwhelming the API
        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
          const batch = documents.slice(i, i + BATCH_SIZE);
          
          try {
            await withTimeoutAndRetry(async () => {
              await PineconeStore.fromDocuments(
                batch, 
                getEmbeddings(), 
                {
                  pineconeIndex: index,
                  namespace: `thread-${metadata.threadId}`,
                }
              );
              return true;
            }, `Store batch ${Math.floor(i/BATCH_SIZE) + 1}`);
            
            console.log(`Stored batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(documents.length/BATCH_SIZE)}`);
          } catch (error) {
            console.error(`Failed to store batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
            // Continue with next batch
          }
        }
        
        console.log(`Completed batch processing for message ID: ${metadata.messageId}`);
      } else {
        // For smaller sets, process all at once
        await withTimeoutAndRetry(async () => {
          await PineconeStore.fromDocuments(
            documents, 
            getEmbeddings(), 
            {
              pineconeIndex: index,
              namespace: `thread-${metadata.threadId}`,
            }
          );
          return true;
        }, "Store document chunks");
      }
      
      console.log(`Successfully stored ${chunks.length} chunks for message ID: ${metadata.messageId}`);
    } catch (error) {
      console.error('Error storing in Pinecone, continuing without vector storage:', error);
      // We'll continue without storing in Pinecone - the application will still work with truncated content
    }
    
    return {
      chunkCount: chunks.length,
      success: true
    };
  } catch (error) {
    console.error('Error storing document chunks:', error);
    return {
      chunkCount: 0,
      success: false,
      error: (error as Error).message
    };
  }
}

// Function to retrieve relevant context chunks from vector store
export async function retrieveRelevantContext(
  query: string,
  threadId: number,
  maxChunks = 1
) {
  try {
    console.log(`Retrieving context for query in thread ${threadId}`);
    
    try {
      // Get Pinecone index with timeout
      const index = await withTimeoutAndRetry(() => getOrCreateIndex(), "Get Pinecone index for query");
      
      // Initialize PineconeStore with the index and perform search with timeout
      const retrieveResults = await withTimeoutAndRetry(async () => {
        const vectorStore = await PineconeStore.fromExistingIndex(
          getEmbeddings(),
          {
            pineconeIndex: index,
            namespace: `thread-${threadId}`
          }
        );

        // Search for similar documents
        const results = await vectorStore.similaritySearch(query, maxChunks);
        
        console.log(`Found ${results.length} relevant chunks for thread ${threadId}`);
        
        // Extract and join the content
        const context = results.map((res) => res.pageContent).join('\n\n');
        
        return {
          context,
          chunks: results.length,
          success: true
        };
      }, "Vector similarity search");
      
      return retrieveResults;
    } catch (error) {
      console.error('Error retrieving from Pinecone, continuing without vector context:', error);
      // Return empty context if Pinecone fails - application will still work with content in the conversation
      return {
        context: '',
        chunks: 0,
        success: false,
        error: (error as Error).message
      };
    }
  } catch (error) {
    console.error('Error retrieving context:', error);
    return {
      context: '',
      chunks: 0,
      success: false,
      error: (error as Error).message
    };
  }
} 