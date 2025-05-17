import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';


// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  console.log('messages: ', JSON.stringify(messages));
  // [
  //   { role: 'user', content: 'hello', parts: [ [Object] ] },
  //   {
  //     role: 'assistant',
  //     content: 'Hello! How can I assist you today?',
  //     parts: [ [Object], [Object] ]
  //   },
  //   { role: 'user', content: 'how are you today', parts: [ [Object] ] }
  // ]
  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a helpful assistant.',
    messages,
  });

  return result.toDataStreamResponse();
}

// app/api/chat/route.ts
// import { openai } from '@ai-sdk/openai';
// import { streamText } from 'ai';

// // Allow streaming responses up to 60 seconds for PDF processing
// export const maxDuration = 60;

// export async function POST(req: Request) {
//   try {
//     const { messages, experimental_attachments } = await req.json();
//     console.log('experimental_attachments: ', experimental_attachments);
//     console.log('messages: ', messages);
    
//     // Create a transformed messages array that includes file attachments
//     const transformedMessages = messages.map(message => {
//       if (message.experimental_attachments?.length > 0) {
//         // For OpenAI, we need to transform PDF files into the appropriate format
//         // This assumes we're working with PDFs as file data URLs
//         const attachments = message.experimental_attachments.map(attachment => {
//           if (attachment.contentType === 'application/pdf') {
//             // Process the PDF attachment
//             // For OpenAI, you might need to extract text from PDF first
//             // or use their file upload API depending on your integration
//             return {
//               type: 'file_attachment',
//               file_url: attachment.url,
//               // If using OpenAI's file API:
//               // file_id: uploadedFileId
//             };
//           }
//           return null;
//         }).filter(Boolean);
        
//         return {
//           ...message,
//           content: [
//             { type: 'text', text: message.content },
//             ...attachments
//           ]
//         };
//       }
//       return message;
//     });

//     const result = streamText({
//       model: openai('gpt-4o'), // Use a model that can handle files/images
//       system: 'You are a helpful assistant that can analyze PDF documents uploaded by users and answer questions about them.',
//       messages: transformedMessages,
//       // Add any additional OpenAI parameters needed for file processing
//       maxTokens: 2000,
//     });

//     return result.toDataStreamResponse();
//   } catch (error) {
//     console.error('Error processing chat request:', error);
//     return new Response(
//       JSON.stringify({ error: 'Failed to process the request' }),
//       { status: 500, headers: { 'content-type': 'application/json' } }
//     );
//   }
// }