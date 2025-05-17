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
}

export default function DashboardPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 获取用户的线程列表
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
    const response = await fetch(`/api/threads/${ threadId }/messages`);
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
    if (!input.trim() && !pdfFile) return;

    let response, data;

    if (pdfFile) {
      console.log('pdfFile: ', pdfFile);
      // PDF 上传
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('threadId', selectedThreadId ? String(selectedThreadId) : '');
      // 可选：附加 input 内容作为描述
      if (input.trim()) formData.append('desc', input);

      response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      });
    } else {
      // 文本消息
      response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input, threadId: selectedThreadId }),
      });
    }

    data = await response.json();
    if (response.ok) {
      setInput('');
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (!selectedThreadId) {
        setThreads((prev) => [{ id: data.threadId, title: 'New Conversation' }, ...prev]);
        setSelectedThreadId(data.threadId);
      } else {
        fetchMessages(selectedThreadId!);
      }
    } else if (response.status === 401) {
      router.push('/login');
    } else {
      console.error('Error:', data.error);
    }
  };


  return (
    <div style={ { display: 'flex', height: '100vh' } }>
      {/* 侧边栏 */ }
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

      {/* 主体部分 */ }
      <div style={ { flex: 1, display: 'flex', flexDirection: 'column' } }>
        {/* 消息显示区域 */ }
        <div style={ { flex: 1, padding: '10px', overflowY: 'auto' } }>
          { selectedThreadId ? (
            messages.map((msg) => (
              <div key={ msg.id } style={ { marginBottom: '10px' } }>
                <strong>{ msg.senderType === 'user' ? 'You' : 'Assistant' }:</strong>
                <MessageContent senderType={ msg.senderType } content={ msg.content } />
              </div>
            ))
          ) : (
            <p>Select a thread or start a new conversation.</p>
          ) }
        </div>

        {/* 输入框 */}
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
            disabled={!!pdfFile}
            placeholder={pdfFile ? 'PDF selected, ready to send...' : 'Input the content you want to do summary... (Ctrl+Enter to send)'}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ marginRight: '10px' }}
            title="Upload PDF"
          >
            +
          </button>
          <input
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button onClick={handleSubmit} disabled={!input.trim() && !pdfFile}>
            Send
          </button>
          {pdfFile && (
            <span style={{ marginLeft: 10, color: '#888' }}>
              {pdfFile.name}
              <button onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} style={{ marginLeft: 5 }}>x</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}