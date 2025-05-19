'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  InputAdornment,
  useTheme,
  AppBar,
  Toolbar,
  Tooltip,
  CircularProgress,
  useMediaQuery,
  Drawer,
  Menu,
  MenuItem,
  Avatar,
  ListItemIcon,
  Divider
} from '@mui/material';
import MessageContent from './dashboard/MessageContent';
import Sidebar from './dashboard/Sidebar';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LogoutIcon from '@mui/icons-material/Logout';
import AnalyticsIcon from '@mui/icons-material/BarChart';
import PersonIcon from '@mui/icons-material/Person';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';

interface Thread {
  id: number;
  title: string;
  status?: string;
}

interface Message {
  id: number;
  senderType: string;
  content: string;
  contentType: string;
  fileName?: string;
  linkUrl?: string;
  createdAt: string;
  isPending?: boolean;
}

// Wrapper component that uses searchParams
function MainContent(): React.ReactNode {
  const router = useRouter();
  const theme = useTheme();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  
  // Mobile sidebar state
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Add state for user menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // URL parameter and thread selection logic
  useEffect(() => {
    const threadId = searchParams.get('threadId');
    if (threadId) {
      const numThreadId = Number(threadId);
      if (!isNaN(numThreadId) && numThreadId !== selectedThreadId) {
        setSelectedThreadId(numThreadId);
      }
    } else if (selectedThreadId !== null && pathname === '/' && !searchParams.has('threadId')) {
      setSelectedThreadId(null);
    }
  }, [searchParams, pathname]);

  // Fetch messages when thread changes
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

        const threadId = searchParams.get('threadId');
        if (threadId) {
          const numThreadId = Number(threadId);
          const threadExists = data.threads.some((t: Thread) => t.id === numThreadId);
          if (!threadExists) {
            router.replace('/');
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
      const response = await fetch(`/api/threads/${threadId}/messages`);

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      } else if (response.status === 401) {
        router.push('/login');
      } else if (response.status === 404) {
        setSelectedThreadId(null);
        router.replace('/');
      } else {
        console.error('Failed to fetch messages', await response.text());
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
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
    if (threadId === null) {
      setSelectedThreadId(null);
      router.replace('/');
    } else {
      setSelectedThreadId(threadId);
      router.push(`/?threadId=${threadId}`);
    }
  };

  const handleSubmit = async () => {
    if ((!input.trim() && !pdfFile) || isSubmitting) return;

    setIsSubmitting(true);

    // Create temporary message object
    const tempMessage: Message = {
      id: Date.now(),
      senderType: 'user',
      content: input.trim(),
      contentType: pdfFile ? 'pdf' : 'text',
      fileName: pdfFile?.name,
      createdAt: new Date().toISOString(),
      isPending: true
    };

    // Add temporary AI message for streaming
    const tempAIMessage: Message = {
      id: Date.now() + 1,
      senderType: 'assistant',
      content: '',
      contentType: 'text',
      createdAt: new Date().toISOString(),
      isPending: true
    };

    // Update UI immediately with both messages
    setMessages(prev => [...prev, tempMessage, tempAIMessage]);

    // Clear input and file
    setInput('');
    setPdfFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      const formData = new FormData();

      if (input) {
        formData.append('text', input);
      }

      if (pdfFile) {
        formData.append('file', pdfFile);
        formData.append('fileName', pdfFile.name);
      }

      if (selectedThreadId) {
        formData.append('threadId', selectedThreadId.toString());
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        if (!response.body) {
          throw new Error('No response body');
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and add to accumulated content
          const chunk = decoder.decode(value);
          accumulatedContent += chunk;

          // Update the AI message content in real-time
          setMessages(prev => 
            prev.map(msg => 
              msg.id === tempAIMessage.id 
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        }

        // Update messages to remove pending state
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempMessage.id || msg.id === tempAIMessage.id
              ? { ...msg, isPending: false }
              : msg
          )
        );

        if (!selectedThreadId) {
          // Get the thread ID from the response headers
          const threadId = response.headers.get('x-thread-id');
          if (threadId) {
            setSelectedThreadId(Number(threadId));
            router.push(`/?threadId=${threadId}`);

            // Refresh thread list
            const threadsResponse = await fetch('/api/threads');
            if (threadsResponse.ok) {
              const threadsData = await threadsResponse.json();
              setThreads(threadsData.threads);
            }
          }
        } else {
          // Refresh thread list to update status
          const threadsResponse = await fetch('/api/threads');
          if (threadsResponse.ok) {
            const threadsData = await threadsResponse.json();
            setThreads(threadsData.threads);
          }
        }
      } else {
        const data = await response.json();
        console.error('Error sending message:', data.error);
        
        // Remove both temporary messages on error
        setMessages(prev => 
          prev.filter(m => m.id !== tempMessage.id && m.id !== tempAIMessage.id)
        );
        
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      
      // Remove both temporary messages on error
      setMessages(prev => 
        prev.filter(m => m.id !== tempMessage.id && m.id !== tempAIMessage.id)
      );
      
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleRetry = async (threadId: number) => {
    if (!threadId || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Find the last user message and the failed assistant message (if it exists)
      const userMessages = messages.filter(msg => msg.senderType === 'user');
      const lastUserMessage = userMessages[userMessages.length - 1];
      
      // Create temporary AI message for streaming
      const tempAIMessage: Message = {
        id: Date.now(),
        senderType: 'assistant',
        content: '',
        contentType: 'text',
        createdAt: new Date().toISOString(),
        isPending: true
      };
      
      // Add temporary AI message to UI
      setMessages(prev => {
        // Filter out any existing failed AI messages if present
        const filteredMessages = prev.filter(msg => 
          !(msg.senderType === 'assistant' && messages.indexOf(msg) > messages.indexOf(lastUserMessage))
        );
        return [...filteredMessages, tempAIMessage];
      });
      
      // Call the retry API endpoint
      const response = await fetch('/api/messages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threadId }),
      });
      
      if (response.ok) {
        if (!response.body) {
          throw new Error('No response body');
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and add to accumulated content
          const chunk = decoder.decode(value);
          accumulatedContent += chunk;

          // Update the AI message content in real-time
          setMessages(prev => 
            prev.map(msg => 
              msg.id === tempAIMessage.id 
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        }

        // Update messages to remove pending state
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempAIMessage.id
              ? { ...msg, isPending: false }
              : msg
          )
        );
        
        // Refresh thread list to update status
        const threadsResponse = await fetch('/api/threads');
        if (threadsResponse.ok) {
          const threadsData = await threadsResponse.json();
          setThreads(threadsData.threads);
        }
      } else {
        const data = await response.json();
        console.error('Retry failed:', data.error);
        
        // Remove temporary message and show error
        setMessages(prev => 
          prev.filter(msg => msg.id !== tempAIMessage.id)
        );
        
        alert(`Error: ${data.error || 'Failed to retry'}`);
      }
    } catch (error) {
      console.error('Error during retry:', error);
      
      // Remove temporary AI message
      setMessages(prev => 
        prev.filter(msg => msg.senderType !== 'assistant' || !msg.isPending)
      );
      
      alert('An error occurred while retrying.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleAnalyticsClick = () => {
    handleUserMenuClose();
    router.push('/analytics');
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar - shown as permanent on desktop, as drawer on mobile */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            '& .MuiDrawer-paper': { 
              width: 280,
              boxSizing: 'border-box',
            },
            display: { xs: 'block', sm: 'none' },
          }}
        >
          <Sidebar
            threads={threads}
            selectedThreadId={selectedThreadId}
            onThreadSelect={(threadId) => {
              handleThreadSelect(threadId);
              setMobileOpen(false); // Close drawer after selection on mobile
            }}
            onClose={handleDrawerToggle}
          />
        </Drawer>
      ) : (
        <Box
          component="nav"
          sx={{ 
            width: { sm: 280 },
            flexShrink: 0,
            display: { xs: 'none', sm: 'block' } 
          }}
        >
          <Sidebar
            threads={threads}
            selectedThreadId={selectedThreadId}
            onThreadSelect={handleThreadSelect}
          />
        </Box>
      )}

      {/* Main content area */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <AppBar
          position="static"
          color="default"
          elevation={0}
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {isMobile && (
                <IconButton
                  color="primary"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{ mr: 2 }}
                >
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h6" color="primary" noWrap>
                {selectedThreadId
                  ? threads.find(t => t.id === selectedThreadId)?.title || 'Conversation'
                  : 'New Conversation'}
              </Typography>
            </Box>
            
            {/* User profile button and menu */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="Account settings">
                <Button
                  onClick={handleUserMenuOpen}
                  color="primary"
                  sx={{ 
                    textTransform: 'none',
                    ml: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                  endIcon={<PersonIcon />}
                >
                  {userName}
                </Button>
              </Tooltip>
              
              <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={openMenu}
                onClose={handleUserMenuClose}
                onClick={handleUserMenuClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    mt: 1.5,
                    '& .MuiAvatar-root': {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                    '&:before': {
                      content: '""',
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      right: 14,
                      width: 10,
                      height: 10,
                      bgcolor: 'background.paper',
                      transform: 'translateY(-50%) rotate(45deg)',
                      zIndex: 0,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem onClick={handleAnalyticsClick}>
                  <ListItemIcon>
                    <AnalyticsIcon fontSize="small" />
                  </ListItemIcon>
                  Analytics
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Messages area */}
        <Box
          ref={messageContainerRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2, md: 4 }, // Smaller padding on mobile
            py: 2,
            backgroundColor: theme.palette.background.default
          }}
        >
          {messages.length > 0 ? (
            messages.map((message) => (
              <MessageContent
                key={message.id}
                senderType={message.senderType}
                content={message.content}
                contentType={message.contentType}
                fileName={message.fileName}
                linkUrl={message.linkUrl}
                timestamp={message.createdAt}
                isPending={message.isPending}
                threadId={selectedThreadId || undefined}
                threadStatus={threads.find(t => t.id === selectedThreadId)?.status}
                isLastUserMessage={
                  message.senderType === 'user' && 
                  message.id === [...messages]
                    .filter(m => m.senderType === 'user')
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id
                }
                onRetry={handleRetry}
              />
            ))
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'text.secondary'
              }}
            >
              {selectedThreadId ? (
                <Typography>No messages yet. Start the conversation!</Typography>
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color="primary" gutterBottom>
                    Welcome to AI Summary
                  </Typography>
                  <Typography>
                    Start a new conversation by typing a message below
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input area */}
        <Box sx={{
          p: { xs: 1.5, sm: 2 }, // Smaller padding on mobile
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper
        }}>
          {pdfFile && (
            <Paper
              variant="outlined"
              sx={{
                p: 1,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AttachFileIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="body2" noWrap sx={{ maxWidth: '300px' }}>
                  {pdfFile.name}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setPdfFile(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Paper>
          )}

          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: theme.palette.background.default,
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <input
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <IconButton
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      color="primary"
                    >
                      <AttachFileIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={!input.trim() && !pdfFile}
              sx={{
                minWidth: isSubmitting ? '120px' : '50px',
                height: '50px',
                borderRadius: isSubmitting ? '25px' : '50%',
                transition: 'min-width 0.3s ease',
              }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// Main page component with Suspense boundary
export default function HomePage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <MainContent />
    </Suspense>
  );
}
