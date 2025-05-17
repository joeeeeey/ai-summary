'use client';

import { useChat } from '@ai-sdk/react';


export default function Page() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({});
  console.log('input: ', input);
  console.log('messages: ', messages);

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input name="prompt" value={input} onChange={handleInputChange} />
        <button type="submit">Submit</button>
      </form>
    </>
  );
}

// 'use client';

// import { useChat } from '@ai-sdk/react';
// import { useRef, useState } from 'react';

// export default function ChatWithPDF() {
//   const {
//     messages,
//     input,
//     handleInputChange,
//     handleSubmit,
//     status,
//     isLoading
//   } = useChat();
  
//   const [files, setFiles] = useState(null);
//   const fileInputRef = useRef(null);
  
//   return (
//     <div className="max-w-3xl mx-auto p-4">
//       <h1 className="text-2xl font-bold mb-4">Chat with PDF</h1>
      
//       <div className="border rounded-lg p-4 mb-4 h-96 overflow-y-auto">
//         {messages.map(message => (
//           <div 
//             key={message.id} 
//             className={`mb-4 p-3 rounded-lg ${
//               message.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
//             } max-w-[80%]`}
//           >
//             <div className="font-bold">
//               {message.role === 'user' ? 'You' : 'AI'}:
//             </div>
//             <div>{message.content}</div>
            
//             {/* Display PDF attachments */}
//             {message.experimental_attachments?.filter(
//               attachment => attachment.contentType === 'application/pdf'
//             ).map((attachment, index) => (
//               <div key={`${message.id}-${index}`} className="mt-2">
//                 <a 
//                   href={attachment.url} 
//                   target="_blank" 
//                   rel="noopener noreferrer"
//                   className="text-blue-500 underline"
//                 >
//                   {attachment.name || 'PDF Attachment'}
//                 </a>
//               </div>
//             ))}
//           </div>
//         ))}
        
//         {status === 'streaming' && (
//           <div className="bg-gray-100 p-3 rounded-lg max-w-[80%]">
//             <div className="font-bold">AI:</div>
//             <div>Thinking...</div>
//           </div>
//         )}
//       </div>
      
//       <form 
//         onSubmit={event => {
//           handleSubmit(event, {
//             experimental_attachments: files
//           });
//           setFiles(null);
//           if (fileInputRef.current) {
//             fileInputRef.current.value = '';
//           }
//         }}
//         className="flex flex-col gap-2"
//       >
//         <div className="flex items-center gap-2">
//           <input
//             type="file"
//             onChange={event => {
//               if (event.target.files) {
//                 setFiles(event.target.files);
//               }
//             }}
//             accept="application/pdf"
//             ref={fileInputRef}
//             className="flex-1"
//           />
//           <span className="text-sm text-gray-500">
//             {files ? `${files.length} file(s) selected` : 'No file selected'}
//           </span>
//         </div>
        
//         <div className="flex gap-2">
//           <input
//             className="flex-1 p-2 border rounded"
//             value={input}
//             placeholder="Ask about the PDF..."
//             onChange={handleInputChange}
//             disabled={status !== 'ready'}
//           />
//           <button 
//             type="submit" 
//             disabled={status !== 'ready'}
//             className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
//           >
//             Send
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// }