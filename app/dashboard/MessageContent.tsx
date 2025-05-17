// app/dashboard/MessageContent.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MessageContentProps {
  senderType: string;
  content: string;
  contentType: string;
  fileName?: string;
  linkUrl?: string;
  timestamp?: string;
}

export default function MessageContent({ 
  senderType, 
  content, 
  contentType, 
  timestamp, 
  fileName, 
  linkUrl 
}: MessageContentProps) {
  // Log props for debugging
  console.log('MessageContent props:', { senderType, contentType, fileName, linkUrl });
  
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
    // Enhanced PDF display with icon and filename
    const displayFileName = fileName || 'PDF Document';
    console.log('Rendering PDF with filename:', displayFileName);
    
    renderedContent = (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          display: 'inline-block',
          width: '24px',
          height: '28px',
          backgroundColor: '#ff4d4d',
          position: 'relative',
          borderRadius: '2px',
          marginRight: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
        }}>
          {/* PDF icon white corner fold */}
          <div style={{
            position: 'absolute',
            top: '0',
            right: '0',
            width: '0',
            height: '0',
            borderStyle: 'solid',
            borderWidth: '6px',
            borderColor: 'white transparent transparent white',
          }} />
          
          {/* PDF text lines */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '4px',
            width: '16px',
            height: '2px',
            backgroundColor: 'white',
          }} />
          <div style={{
            position: 'absolute',
            top: '13px',
            left: '4px',
            width: '16px',
            height: '2px',
            backgroundColor: 'white',
          }} />
          <div style={{
            position: 'absolute',
            top: '18px',
            left: '4px',
            width: '12px',
            height: '2px',
            backgroundColor: 'white',
          }} />
        </div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>PDF Document</div>
          <div style={{ fontSize: '0.85em', opacity: 0.9, wordBreak: 'break-all' }}>{displayFileName}</div>
        </div>
      </div>
    );
  } else if (contentType === 'link') {
    // Display for web link content
    const displayUrl = linkUrl || 'Web Content';
    console.log('Rendering link with URL:', displayUrl);
    
    renderedContent = (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{
            display: 'inline-block',
            width: '24px',
            height: '24px',
            backgroundColor: '#4285F4',
            position: 'relative',
            borderRadius: '50%',
            marginRight: '10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
          }}>
            {/* Link icon */}
            <div style={{
              position: 'absolute',
              top: '7px',
              left: '7px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              border: '2px solid white',
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.85em', opacity: 0.9, wordBreak: 'break-all' }}>
              <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'white' }}>
                {displayUrl}
              </a>
            </div>
          </div>
        </div>
        <ReactMarkdown>{content}</ReactMarkdown>
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