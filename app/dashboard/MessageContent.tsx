// app/dashboard/MessageContent.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MessageContentProps {
  senderType: string;
  content: string;
}

export default function MessageContent({ senderType, content }: MessageContentProps) {
  if (senderType === 'assistant') {
    // Markdown 渲染
    return <ReactMarkdown>{content}</ReactMarkdown>;
  }
  // 用户消息直接渲染文本
  return <span>{content}</span>;
}