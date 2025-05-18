'use client';

import { useEffect, useState, useRef } from 'react';
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
  useMediaQuery,
  Drawer,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider
} from '@mui/material';
import MessageContent from './MessageContent';
import Sidebar from './Sidebar';
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

export default function DashboardContent() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState('User');
  
  // Mobile sidebar state
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // User menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
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
    } else if (selectedThreadId !== null && pathname === '/dashboard' && !searchParams.has('threadId')) {
      setSelectedThreadId(null);
    }
  }, [searchParams, pathname, selectedThreadId]);

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
            router.replace('/dashboard');
          }
        }
      } else if (response.status === 401) {
        router.push('/login');
      }
    };

    fetchThreads();
  }, [router, searchParams]);

  // Get user info 
  useEffect(() => {
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
    
    fetchUserInfo();
  }, []);

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
        router.replace('/dashboard');
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
      router.replace('/dashboard');
    } else {
      setSelectedThreadId(threadId);
      router.push(`/dashboard?threadId=${threadId}`);
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

    // Update UI immediately
    setMessages(prev => [...prev, tempMessage]);

    // Clear input and file
    setInput('');
    setPdfFile(null);

    try {
      // Prepare form data
      const formData = new FormData();
      if (pdfFile) {
        formData.append('file', pdfFile);
      }
      if (input.trim()) {
        formData.append('text', input.trim());
      }
      if (selectedThreadId) {
        formData.append('threadId', selectedThreadId.toString());
      }

      // Send message to server
      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh messages or update thread ID if new
        if (!selectedThreadId && data.threadId) {
          setSelectedThreadId(data.threadId);
          router.push(`/dashboard?threadId=${data.threadId}`);
        } else if (selectedThreadId) {
          fetchMessages(selectedThreadId);
        }
      } else {
        console.error('Error sending message:', await response.text());
        // Remove the pending message on error
        setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      // Remove the pending message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
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

  const handleRetry = (messageId: number) => {
    // Implement the logic to retry sending a message
    console.log(`Retrying message with id: ${messageId}`);
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
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Toolbar>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              {isMobile && (
                <IconButton
                  edge="start"
                  color="primary"
                  aria-label="open drawer"
                  onClick={handleDrawerToggle}
                  sx={{ mr: 2 }}
                >
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
                {selectedThreadId ? `Chat #${selectedThreadId}` : 'New Chat'}
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

        {/* Message area */}
        <Box
          ref={messageContainerRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: { xs: 1.5, sm: 2 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            backgroundColor: theme.palette.background.default,
          }}
        >
          {messages.map((message) => (
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
              isLastUserMessage={
                message.senderType === 'user' && 
                message.id === [...messages]
                  .filter(m => m.senderType === 'user')
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id
              }
              onRetry={handleRetry}
            />
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input area */}
        <Paper
          elevation={3}
          component="form"
          sx={{
            p: { xs: 1.5, sm: 2 },
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          {/* File upload button */}
          <input
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <IconButton
            color="primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <AttachFileIcon />
          </IconButton>

          {/* PDF file indicator */}
          {pdfFile && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
                borderRadius: 1,
                py: 0.5,
                px: 1,
                mr: 1,
              }}
            >
              <Typography variant="body2" sx={{ mr: 1 }}>
                {pdfFile.name}
              </Typography>
              <IconButton
                size="small"
                sx={{ color: 'inherit', p: 0 }}
                onClick={() => setPdfFile(null)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          )}

          {/* Text input */}
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={pdfFile ? "Add a message (optional)..." : "Type your message..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    color="primary"
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!input.trim() && !pdfFile)}
                  >
                    <SendIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Paper>
      </Box>
    </Box>
  );
} 