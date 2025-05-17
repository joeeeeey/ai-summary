import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Thread {
  id: number;
  title: string;
}

interface SidebarProps {
  threads: Thread[];
  selectedThreadId: number | null;
  onThreadSelect: (threadId: number) => void;
}

export default function Sidebar({ threads, selectedThreadId, onThreadSelect }: SidebarProps) {
  const [hoveredThreadId, setHoveredThreadId] = useState<number | null>(null);
  const router = useRouter();

  const handleNewConversation = () => {
    router.push('/dashboard');
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