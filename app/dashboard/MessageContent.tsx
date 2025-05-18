// app/dashboard/MessageContent.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Box, 
  Typography, 
  Paper,
  useTheme,
  CircularProgress,
  IconButton,
  Tooltip,
  useMediaQuery
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import LinkIcon from '@mui/icons-material/Link';
import ReplayIcon from '@mui/icons-material/Replay';

interface MessageContentProps {
  senderType: string;
  content: string;
  contentType: string;
  fileName?: string;
  linkUrl?: string;
  timestamp?: string;
  isPending?: boolean;
  threadId?: number;
  threadStatus?: string;
  isLastUserMessage?: boolean;
  onRetry?: (threadId: number) => void;
}

export default function MessageContent({ 
  senderType, 
  content, 
  contentType, 
  timestamp, 
  fileName, 
  linkUrl,
  isPending = false,
  threadId,
  threadStatus,
  isLastUserMessage = false,
  onRetry
}: MessageContentProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Format timestamp if provided
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) : '';

  const isUser = senderType === 'user';
  const showRetry = isUser && isLastUserMessage && threadStatus === 'failed' && threadId && onRetry;
  
  // Handle retry click
  const handleRetry = () => {
    if (threadId && onRetry) {
      onRetry(threadId);
    }
  };

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
          <InsertDriveFileIcon fontSize={isMobile ? "small" : "medium"} />
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5, fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>
            PDF Document
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, wordBreak: 'break-all', fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
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
            <LinkIcon fontSize={isMobile ? "small" : "medium"} />
          </Box>
          <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
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
        mb: { xs: 1, sm: 2 },
        position: 'relative',
      }}
    >
      {!isUser && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary',
            mb: 0.5,
            ml: isUser ? 0 : 1,
            fontSize: { xs: '0.65rem', sm: '0.75rem' }
          }}
        >
          ai-summary
        </Typography>
      )}
      
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2 },
          pb: { xs: 2, sm: 2.5 }, // Extra space for timestamp
          maxWidth: { xs: '90%', sm: '80%' },
          minWidth: { xs: '100px', sm: '120px' },
          borderRadius: 2,
          position: 'relative',
          backgroundColor: showRetry ? '#ff4d4d' : isUser ? theme.palette.primary.main : '#2D3748',
          color: 'white',
          opacity: isPending ? 0.7 : 1,
          '.markdown-content': {
            fontSize: { xs: '0.9rem', sm: '1rem' },
            '& a': {
              color: isUser ? '#FFFFFF' : theme.palette.primary.light,
            },
            '& pre': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              padding: { xs: 0.75, sm: 1 },
              borderRadius: 1,
              overflowX: 'auto',
              fontSize: { xs: '0.8rem', sm: '0.9rem' },
            },
            '& code': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              padding: '2px 4px',
              borderRadius: '3px',
              fontFamily: 'monospace',
              fontSize: { xs: '0.8rem', sm: '0.9rem' },
            },
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
              fontSize: { xs: '0.65rem', sm: '0.7rem' },
            }}
          >
            <CircularProgress size={isMobile ? 8 : 10} color="inherit" />
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                whiteSpace: 'nowrap',
              }}
            >
              Processing...
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
                fontSize: { xs: '0.65rem', sm: '0.7rem' },
              }}
            >
              {formattedTime}
            </Typography>
          )
        )}
      </Paper>
      
      {/* Show retry button for failed threads */}
      {showRetry && (
        <Box sx={{ mt: 1 }}>
          <Tooltip title="Retry AI generation">
            <IconButton 
              size="small" 
              color="primary" 
              onClick={handleRetry}
              sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            >
              <ReplayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}