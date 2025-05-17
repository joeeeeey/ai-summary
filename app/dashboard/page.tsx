'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import MessageContent from './MessageContent';

// Define a simple SidebarComponent to use until the import issue is resolved
function SidebarComponent({ 
  threads, 
  selectedThreadId, 
  onThreadSelect 
}: { 
  threads: { id: number; title: string }[]; 
  selectedThreadId: number | null; 
  onThreadSelect: (id: number | null) => void; 
}) {
  const [hoveredThreadId, setHoveredThreadId] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const handleNewConversation = () => {
    // 清除当前选中的线程
    onThreadSelect(null);
    // 直接清除 URL 参数
    router.replace('/dashboard');
  };

  return (
    <div style={{ 
      width: '250px', 
      borderRight: '1px solid #ccc', 
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Thread list with scrolling */}
      <div style={{
        flex: 1,
        overflowY: 'auto'
      }}>
        <h3 style={{ padding: '10px', margin: 0 }}>Threads</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {threads.map((thread) => (
            <li
              key={thread.id}
              onClick={() => onThreadSelect(thread.id)}
              onMouseEnter={() => setHoveredThreadId(thread.id)}
              onMouseLeave={() => setHoveredThreadId(null)}
              style={{
                padding: '10px',
                cursor: 'pointer',
                backgroundColor: 
                  thread.id === selectedThreadId 
                    ? '#889ccf' 
                    : thread.id === hoveredThreadId 
                      ? '#e9ecef' 
                      : 'transparent',
                color: thread.id === selectedThreadId ? 'white' : 'inherit',
                borderBottom: '1px solid #eee',
                transition: 'background-color 0.2s ease'
              }}
            >
              {thread.title}-{thread.id}
            </li>
          ))}
        </ul>
      </div>
      
      {/* Action area at bottom */}
      <div style={{ 
        padding: '15px', 
        borderTop: '1px solid #eee',
        backgroundColor: '#f8f9fa'
      }}>
        <button 
          onClick={handleNewConversation}
          style={{
            width: '100%',
            padding: '8px 0',
            backgroundColor: '#889ccf',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Start New Conversation
        </button>
      </div>
    </div>
  );
}

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState('User');
  const [sidebarLoaded, setSidebarLoaded] = useState(true);

  // Force a component reload if sidebar fails to load
  useEffect(() => {
    // This effect will run once on mount
    if (!sidebarLoaded) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sidebarLoaded]);

  // 分离 URL 参数和线程选择的逻辑
  useEffect(() => {
    // 只有在页面加载和 URL 变化时更新选中线程
    const threadId = searchParams.get('threadId');
    if (threadId) {
      const numThreadId = Number(threadId);
      if (!isNaN(numThreadId) && numThreadId !== selectedThreadId) {
        setSelectedThreadId(numThreadId);
      }
    } else if (selectedThreadId !== null && pathname === '/dashboard' && !searchParams.has('threadId')) {
      // 如果URL中没有threadId参数但状态中有，重置状态
      setSelectedThreadId(null);
    }
  }, [searchParams, pathname]);

  // 分离获取消息的逻辑
  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    } else {
      setMessages([]);
    }
  }, [selectedThreadId]);

  // Get user's thread list and user info
  useEffect(() => {
    const fetchThreads = async () => {
      const response = await fetch('/api/threads');
      if (response.ok) {
        const data = await response.json();
        setThreads(data.threads);
        
        // 在线程加载完成后，检查URL中是否有threadId
        const threadId = searchParams.get('threadId');
        if (threadId) {
          const numThreadId = Number(threadId);
          // 验证线程存在于列表中
          const threadExists = data.threads.some((t: Thread) => t.id === numThreadId);
          if (!threadExists) {
            // 如果线程不存在，清除URL参数
            router.replace('/dashboard');
          }
        }
      } else if (response.status === 401) {
        router.push('/login');
      }
    };

    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
          const data = await response.json();
          setUserName(data.name || 'User');
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    fetchThreads();
    fetchUserInfo();
  }, [router]);

  const fetchMessages = async (threadId: number) => {
    try {
      console.log('正在获取线程消息:', threadId);
      const response = await fetch(`/api/threads/${threadId}/messages`);
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      } else if (response.status === 401) {
        router.push('/login');
      } else if (response.status === 404) {
        // 线程不存在，清除选择
        console.error('线程不存在');
        setSelectedThreadId(null);
        router.replace('/dashboard');
      } else {
        console.error('获取消息失败', await response.text());
        // 显示错误状态
        setMessages([]);
      }
    } catch (error) {
      console.error('获取消息出错:', error);
      setMessages([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    } else {
      setPdfFile(null);
      alert('Please select a PDF file.');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
      });
      
      if (response.ok) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleThreadSelect = (threadId: number | null) => {
    if (threadId === selectedThreadId) return; // 如果点击相同线程，不执行操作
    
    // 先设置状态
    setSelectedThreadId(threadId);
    
    if (threadId === null) {
      // 如果是清除选择，直接跳转到dashboard
      router.replace('/dashboard');
      return;
    }
    
    // 更新URL，防止状态和URL不同步
    const params = new URLSearchParams();
    params.set('threadId', threadId.toString());
    
    // 使用 router.replace 而不是 router.push 来避免添加新的历史记录
    router.replace(`${pathname}?${params.toString()}`);
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
    
    // Save input values before clearing inputs
    const inputValue = input;
    const fileValue = pdfFile;
    
    // Clear inputs immediately for better UX
    setInput('');
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    // Build the array of temporary messages in correct order
    
    // 1. Always add PDF message first if it exists
    if (fileValue) {
      const pdfMessage = {
        id: tempIdCounter++,
        senderType: 'user',
        content: '', // PDF content is empty on frontend
        contentType: 'pdf',
        fileName: fileValue.name,
        createdAt: currentDate
      };
      tempMessages.push(pdfMessage);
      console.log('Added PDF message:', pdfMessage);
    }
    
    // 2. Then add text message if it exists
    if (inputValue.trim()) {
      const textMessage = {
        id: tempIdCounter++,
        senderType: 'user',
        content: inputValue,
        contentType: 'text',
        createdAt: currentDate
      };
      tempMessages.push(textMessage);
      console.log('Added text message:', textMessage);
    }
    
    // 3. Add loading message
    const loadingMessage: Message = {
      id: tempIdCounter++,
      senderType: 'assistant',
      content: 'Loading...',
      contentType: 'text',
      createdAt: currentDate
    };
    
    console.log('All temp messages before update:', [...tempMessages, loadingMessage]);
    
    // Single update to add all messages to UI in correct order
    setMessages(prev => {
      const updatedMessages = [...prev, ...tempMessages, loadingMessage];
      console.log('Updated messages state:', updatedMessages);
      return updatedMessages;
    });
    
    // Store IDs for potential cleanup
    const tempIds = [...tempMessages.map(msg => msg.id), loadingMessage.id];

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '10px 20px',
        borderBottom: '1px solid #ccc',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>AI Summary</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '15px' }}>{userName}</span>
          <button 
            onClick={handleLogout}
            style={{
              padding: '5px 10px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#889ccf',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>
      
      {/* Main content area with sidebar and messages */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Component */}
        <SidebarComponent 
          threads={threads} 
          selectedThreadId={selectedThreadId}
          onThreadSelect={handleThreadSelect}
        />

        {/* Main content with messages and input */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden'
        }}>
          {/* Message display area - scrollable */}
          <div style={{ 
            flex: 1, 
            padding: '10px', 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {selectedThreadId ? (
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
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%'
              }}>
                <p style={{ color: '#666', fontSize: '1.1rem' }}>
                  Select a thread or start a new conversation.
                </p>
              </div>
            )}
          </div>

          {/* Input area - fixed at bottom */}
          <div style={{ 
            padding: '15px', 
            borderTop: '1px solid #ccc',
            backgroundColor: '#f8f9fa'
          }}>
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
                resize: 'vertical',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
              disabled={isSubmitting}
              placeholder="Input the content you want to do summary... (Ctrl+Enter to send)"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ 
                marginRight: '10px',
                padding: '8px 12px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
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
              style={{
                padding: '8px 15px',
                backgroundColor: (!input.trim() && !pdfFile) || isSubmitting ? '#cccccc' : '#889ccf',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (!input.trim() && !pdfFile) || isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Sending...' : 'Send'}
            </button>
            {pdfFile && (
              <span style={{ marginLeft: 10, color: '#888' }}>
                {pdfFile.name}
                <button 
                  onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} 
                  style={{ 
                    marginLeft: 5,
                    background: 'none',
                    border: 'none',
                    color: '#889ccf',
                    cursor: 'pointer'
                  }}
                  disabled={isSubmitting}
                >
                  x
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}