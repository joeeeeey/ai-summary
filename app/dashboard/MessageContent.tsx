// app/dashboard/MessageContent.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MessageContentProps {
  senderType: string;
  content: string;
  contentType: string;
  fileName?: string;
  timestamp?: string; // Add timestamp prop
}

export default function MessageContent({ senderType, content, contentType, timestamp, fileName }: MessageContentProps) {
  // Format timestamp if provided
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) : '';

  const isUser = senderType === 'user';

  // Define styles based on sender type
  const messageStyle = {
    padding: '12px 16px',
    borderRadius: '8px',
    maxWidth: '80%',
    marginBottom: '4px',
    position: 'relative' as const,
    color: 'white',
    backgroundColor: isUser ? '#889ccf' : '#555b6e',
    paddingBottom: '20px', // Add space for timestamp
  };
  
  const timeStyle = {
    fontSize: '0.7rem',
    color: 'rgba(255, 255, 255, 0.7)',
    position: 'absolute' as const,
    right: '8px',
    bottom: '4px',
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: isUser ? 'flex-end' : 'flex-start', // Reversed alignment
    width: '100%',
    marginBottom: '8px',
  };

  const labelStyle = {
    fontSize: '0.8rem',
    color: '#888',
    marginBottom: '4px',
  };

  // Render content based on type
  let renderedContent;
  
  if (contentType === 'pdf') {
    // CSS-based PDF icon and filename
    renderedContent = (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          display: 'inline-block',
          width: '20px',
          height: '24px',
          backgroundColor: '#ff4d4d',
          position: 'relative',
          borderRadius: '2px',
          marginRight: '8px',
        }}>
          <div style={{
            position: 'absolute',
            top: '6px',
            left: '0',
            width: '100%',
            height: '2px',
            backgroundColor: 'white',
          }} />
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '0',
            width: '100%',
            height: '2px',
            backgroundColor: 'white',
          }} />
          <div style={{
            position: 'absolute',
            top: '14px',
            left: '0',
            width: '70%',
            height: '2px',
            backgroundColor: 'white',
          }} />
        </div>
        <span>{fileName}</span>
      </div>
    );
  } else if (senderType === 'assistant') {
    renderedContent = <ReactMarkdown>{content}</ReactMarkdown>;
  } else {
    renderedContent = <span>{content}</span>;
  }

  return (
    <div style={containerStyle}>
      {!isUser && <div style={labelStyle}>ai-summary</div>}
      <div style={messageStyle}>
        {renderedContent}
        {formattedTime && <span style={timeStyle}>{formattedTime}</span>}
      </div>
    </div>
  );
}