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
    // Check if there's at least one input method (PDF or text)
    if ((!input.trim() && !pdfFile) || isSubmitting) return;

    setIsSubmitting(true);
    
    // Generate temporary IDs for optimistic updates
    const tempId = Date.now();
    const currentDate = new Date().toISOString();
    const tempMessages: Message[] = [];
    let tempIdCounter = tempId;
    
    // Create temporary PDF message if file exists
    if (pdfFile) {
      tempMessages.push({
        id: tempIdCounter++,
        senderType: 'user',
        content: '',
        contentType: 'pdf',
        fileName: pdfFile.name,
        createdAt: currentDate
      });
    }
    
    // Create temporary text message if input exists
    if (input.trim()) {
      tempMessages.push({
        id: tempIdCounter++,
        senderType: 'user',
        content: input,
        contentType: 'text',
        createdAt: currentDate
      });
    }
    
    // Add loading message
    const loadingMessage: Message = {
      id: tempIdCounter++,
      senderType: 'assistant',
      content: 'Loading...',
      contentType: 'text',
      createdAt: currentDate
    };
    
    // Add all temporary messages to the UI
    setMessages(prev => [...prev, ...tempMessages, loadingMessage]);
    
    // Store IDs for potential cleanup
    const tempIds = tempMessages.map(msg => msg.id);
    tempIds.push(loadingMessage.id);
    
    // Save input values before clearing
    const inputValue = input;
    const fileValue = pdfFile;
    
    // Clear inputs
    setInput('');
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    let response: Response;
    let data: ApiResponse;

    try {
      // Prepare the form data for submission
      const formData = new FormData();
      
      if (fileValue) {
        formData.append('file', fileValue);
      }
      
      if (inputValue.trim()) {
        formData.append('text', inputValue);
      }
      
      // Add threadId if we have one
      formData.append('threadId', selectedThreadId ? String(selectedThreadId) : '');
      
      // Make the API request
      response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      });
      
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
        setMessages(prev => prev.filter(msg => !tempIds.includes(msg.id)));
      }
    } catch (error) {
      console.error('Error during submission:', error);
      // Remove optimistic updates on error
      setMessages(prev => prev.filter(msg => !tempIds.includes(msg.id)));
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
            disabled={isSubmitting}
            placeholder="Input the content you want to do summary... (Ctrl+Enter to send)"
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
          <button 
            onClick={handleSubmit} 
            disabled={((!input.trim() && !pdfFile) || isSubmitting)}
          >
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