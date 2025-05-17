'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MessageContent from './MessageContent';


interface Thread {
  id: number;
  title: string;
}

interface Message {
  id: number;
  senderType: string;
  content: string;
  contentType: string;
  fileName?: string;
  createdAt: string;
}

interface ApiResponse {
  threadId: number;
  error?: string;
  messages?: Message[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Get user's thread list
    const fetchThreads = async () => {
      const response = await fetch('/api/threads');
      if (response.ok) {
        const data = await response.json();
        setThreads(data.threads);
      } else if (response.status === 401) {
        router.push('/login');
      }
    };

    fetchThreads();
  }, [router]);

  const fetchMessages = async (threadId: number) => {
    console.log('fetchMessages: ');
    const response = await fetch(`/api/threads/${threadId}/messages`);
    if (response.ok) {
      const data = await response.json();
      setMessages(data.messages);
    } else if (response.status === 401) {
      router.push('/login');
    } else {
      console.error('Error fetching messages.');
    }
  };

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    } else {
      setMessages([]);
    }
  }, [selectedThreadId]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    } else {
      setPdfFile(null);
      alert('Please select a PDF file.');
    }
  };

  const handleSubmit = async () => {
    if ((!input.trim() && !pdfFile) || isSubmitting) return;

    setIsSubmitting(true);
    
    // Generate temporary ID for optimistic update
    const tempId = Date.now();
    const currentDate = new Date().toISOString();
    
    // Create temporary message for optimistic update
    const tempMessage: Message = {
      id: tempId,
      senderType: 'user',
      content: pdfFile ? '' : input,
      contentType: pdfFile ? 'pdf' : 'text',
      fileName: pdfFile?.name,
      createdAt: currentDate
    };
    
    // Add to messages immediately for UI update
    setMessages(prev => [...prev, tempMessage]);
    
    // Add placeholder for assistant response
    const loadingMessage: Message = {
      id: tempId + 1,
      senderType: 'assistant',
      content: 'Loading...',
      contentType: 'text',
      createdAt: currentDate
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    
    // Clear input
    const inputValue = input;
    const fileValue = pdfFile;
    setInput('');
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    let response: Response;
    let data: ApiResponse;

    try {
      if (fileValue) {
        console.log('pdfFile: ', fileValue);
        // PDF upload
        const formData = new FormData();
        formData.append('file', fileValue);
        formData.append('threadId', selectedThreadId ? String(selectedThreadId) : '');
        // Optional: Add input content as description
        if (inputValue.trim()) formData.append('desc', inputValue);

        response = await fetch('/api/messages', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Text message
        response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: inputValue, threadId: selectedThreadId }),
        });
      }

      data = await response.json();
      
      if (response.ok) {
        if (!selectedThreadId) {
          setThreads((prev) => [{ id: data.threadId, title: 'New Conversation' }, ...prev]);
          setSelectedThreadId(data.threadId);
        } else {
          // Replace optimistic updates with real data
          fetchMessages(selectedThreadId);
        }
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        console.error('Error:', data.error);
        // Remove optimistic updates on error
        setMessages(prev => prev.filter(msg => msg.id !== tempId && msg.id !== tempId + 1));
      }
    } catch (error) {
      console.error('Error during submission:', error);
      // Remove optimistic updates on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId && msg.id !== tempId + 1));
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div style={ { display: 'flex', height: '100vh' } }>
      {/* Sidebar */ }
      <div style={ { width: '250px', borderRight: '1px solid #ccc', padding: '10px' } }>
        <h3>Threads</h3>
        <ul style={ { listStyle: 'none', padding: 0 } }>
          { threads.map((thread) => (
            <li
              key={ thread.id }
              onClick={ () => setSelectedThreadId(thread.id) }
              style={ {
                padding: '5px',
                cursor: 'pointer',
                backgroundColor: thread.id === selectedThreadId ? '#889ccf' : 'transparent',
              } }
            >
              { thread.title }-{ thread.id }
            </li>
          )) }
        </ul>
      </div>

      {/* Main content */ }
      <div style={ { flex: 1, display: 'flex', flexDirection: 'column' } }>
        {/* Message display area */ }
        <div style={ { 
          flex: 1, 
          padding: '10px', 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        } }>
          { selectedThreadId ? (
            messages.map((msg) => (
              <MessageContent 
                key={msg.id}
                senderType={msg.senderType}
                content={msg.content}
                contentType={msg.contentType}
                timestamp={msg.createdAt}
                fileName={msg.fileName}
              />
            ))
          ) : (
            <p>Select a thread or start a new conversation.</p>
          ) }
        </div>

        {/* Input area */}
        <div style={{ padding: '10px', borderTop: '1px solid #ccc' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
            }}
            style={{ 
              width: '70%', 
              marginRight: '10px',
              minHeight: '60px',
              padding: '8px',
              resize: 'vertical'
            }}
            disabled={!!pdfFile || isSubmitting}
            placeholder={pdfFile ? 'PDF selected, ready to send...' : 'Input the content you want to do summary... (Ctrl+Enter to send)'}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ marginRight: '10px' }}
            title="Upload PDF"
            disabled={isSubmitting}
          >
            +
          </button>
          <input
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isSubmitting}
          />
          <button onClick={handleSubmit} disabled={(!input.trim() && !pdfFile) || isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
          {pdfFile && (
            <span style={{ marginLeft: 10, color: '#888' }}>
              {pdfFile.name}
              <button 
                onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} 
                style={{ marginLeft: 5 }}
                disabled={isSubmitting}
              >
                x
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}