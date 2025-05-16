'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    console.log('useEffect: ');
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

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input, threadId: selectedThreadId }),
    });

    const data = await response.json();

    if (response.ok) {
      setInput('');
      // 如果是新线程，添加到线程列表并选中
      if (!selectedThreadId) {
        setThreads((prev) => [{ id: data.threadId, title: 'New Conversation' }, ...prev]);
        setSelectedThreadId(data.threadId);
      } else {
        // 更新消息列表
        fetchMessages(selectedThreadId);
      }
    } else if (response.status === 401) {
      router.push('/login');
    } else {
      console.error('Error:', data.error);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* 侧边栏 */}
      <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px' }}>
        <h3>Threads</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {threads.map((thread) => (
            <li
              key={thread.id}
              onClick={() => setSelectedThreadId(thread.id)}
              style={{
                padding: '5px',
                cursor: 'pointer',
                backgroundColor: thread.id === selectedThreadId ? '#889ccf' : 'transparent',
              }}
            >
              {thread.title}-{thread.id}
            </li>
          ))}
        </ul>
      </div>

      {/* 主体部分 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 消息显示区域 */}
        <div style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
          {selectedThreadId ? (
            messages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: '10px' }}>
                <strong>{msg.senderType === 'user' ? 'You' : 'Assistant'}:</strong> {msg.content}
              </div>
            ))
          ) : (
            <p>Select a thread or start a new conversation.</p>
          )}
        </div>

        {/* 输入框 */}
        <div style={{ padding: '10px', borderTop: '1px solid #ccc' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            style={{ width: '80%', marginRight: '10px' }}
          />
          <button onClick={handleSubmit} disabled={!input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}