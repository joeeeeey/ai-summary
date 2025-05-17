// app/dashboard/MessageContent.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Box, 
  Typography, 
  Paper,
  useTheme,
  CircularProgress
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import LinkIcon from '@mui/icons-material/Link';

interface MessageContentProps {
  senderType: string;
  content: string;
  contentType: string;
  fileName?: string;
  linkUrl?: string;
  timestamp?: string;
  isPending?: boolean;
}

export default function MessageContent({ 
  senderType, 
  content, 
  contentType, 
  timestamp, 
  fileName, 
  linkUrl,
  isPending = false
}: MessageContentProps) {
  const theme = useTheme();
  
  // Format timestamp if provided
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) : '';

  const isUser = senderType === 'user';

  // Render content based on type
  let renderedContent;
  
  if (contentType === 'pdf') {
    // Enhanced PDF display with icon and filename
    const displayFileName = fileName || 'PDF Document';
    
    renderedContent = (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box 
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ff4d4d',
            color: 'white',
            borderRadius: '4px',
            p: 0.5,
            mr: 1,
          }}
        >
          <InsertDriveFileIcon />
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            PDF Document
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, wordBreak: 'break-all' }}>
            {displayFileName}
          </Typography>
        </Box>
      </Box>
    );
  } else if (contentType === 'link') {
    // Display for web link content
    const displayUrl = linkUrl || 'Web Content';
    
    renderedContent = (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.palette.primary.main,
              color: 'white',
              borderRadius: '50%',
              p: 0.5,
              mr: 1,
            }}
          >
            <LinkIcon fontSize="small" />
          </Box>
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'white' }}>
              {displayUrl}
            </a>
          </Typography>
        </Box>
        <Box className="markdown-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </Box>
      </Box>
    );
  } else if (senderType === 'assistant') {
    renderedContent = (
      <Box className="markdown-content">
        <ReactMarkdown>{content}</ReactMarkdown>
      </Box>
    );
  } else {
    renderedContent = <Typography variant="body1">{content}</Typography>;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
        mb: 2,
      }}
    >
      {!isUser && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary',
            mb: 0.5,
            ml: isUser ? 0 : 1,
          }}
        >
          ai-summary
        </Typography>
      )}
      
      <Paper
        elevation={0}
        sx={{
          p: 2,
          pb: 2.5, // Extra space for timestamp
          maxWidth: '80%',
          minWidth: '120px', // 添加最小宽度，确保有足够空间显示状态
          borderRadius: 2,
          position: 'relative',
          backgroundColor: isUser ? theme.palette.primary.main : '#2D3748',
          color: 'white',
          opacity: isPending ? 0.7 : 1,
          '.markdown-content a': {
            color: isUser ? '#FFFFFF' : theme.palette.primary.light,
          },
          '.markdown-content pre': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            padding: 1,
            borderRadius: 1,
            overflowX: 'auto',
          },
          '.markdown-content code': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            padding: '2px 4px',
            borderRadius: '3px',
            fontFamily: 'monospace',
          },
        }}
      >
        {renderedContent}
        
        {isPending ? (
          <Box
            sx={{
              position: 'absolute',
              right: 8,
              bottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.7rem',
              maxWidth: '100px', // 限制状态指示器的最大宽度
            }}
          >
            <CircularProgress size={10} color="inherit" />
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.7rem',
                whiteSpace: 'nowrap', // 防止文本换行
              }}
            >
              发送中...
            </Typography>
          </Box>
        ) : (
          formattedTime && (
            <Typography 
              variant="caption" 
              sx={{
                position: 'absolute',
                right: 8,
                bottom: 4,
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.7rem',
              }}
            >
              {formattedTime}
            </Typography>
          )
        )}
      </Paper>
    </Box>
  );
}