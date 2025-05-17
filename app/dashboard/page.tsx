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
  CircularProgress,
  useTheme,
  AppBar,
  Toolbar,
  Tooltip,
  Divider
} from '@mui/material';
import MessageContent from './MessageContent';
import Sidebar from './Sidebar';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LogoutIcon from '@mui/icons-material/Logout';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

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

export default function DashboardPage() {
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
            router.replace('/dashboard');
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

    // 创建临时消息对象并立即添加到UI，标记为发送中
    const tempMessage: Message & { isPending?: boolean } = {
      id: Date.now(), // 临时ID
      senderType: 'user',
      content: input.trim(),
      contentType: pdfFile ? 'pdf' : 'text',
      fileName: pdfFile?.name,
      createdAt: new Date().toISOString(),
      isPending: true // 标记消息为发送中状态
    };

    // 立即更新UI显示用户消息
    setMessages(prev => [...prev, tempMessage]);

    // 保存当前输入，以便可能需要恢复
    const currentInput = input.trim();
    const currentFile = pdfFile;

    // 清空输入框和文件选择
    setInput('');
    setPdfFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      const formData = new FormData();

      if (currentInput) {
        formData.append('text', currentInput);
      }

      if (currentFile) {
        formData.append('file', currentFile);
        formData.append('fileName', currentFile.name);
      }

      if (selectedThreadId) {
        formData.append('threadId', selectedThreadId.toString());
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();

      if (response.ok) {
        if (!selectedThreadId && responseData.threadId) {
          setSelectedThreadId(responseData.threadId);
          router.push(`/dashboard?threadId=${responseData.threadId}`);

          // 更新临时消息状态为已发送（移除isPending标记）
          setMessages(prev =>
            prev.map(msg =>
              msg.id === tempMessage.id ? { ...msg, isPending: false } : msg
            )
          );

          // 刷新线程列表
          const threadsResponse = await fetch('/api/threads');
          if (threadsResponse.ok) {
            const threadsData = await threadsResponse.json();
            setThreads(threadsData.threads);
          }
        } else if (selectedThreadId) {
          // 获取所有消息，包括新的AI响应
          fetchMessages(selectedThreadId);
        }
      } else {
        console.error('Error submitting message:', responseData.error);
        alert(`Error: ${responseData.error || 'Failed to send message'}`);

        // 发送失败时，移除临时消息并恢复输入
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setInput(currentInput);
        setPdfFile(currentFile);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while sending your message.');

      // 发生错误时，移除临时消息并恢复输入
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setInput(currentInput);
      setPdfFile(currentFile);
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

  return (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      bgcolor: theme.palette.background.default
    }}>
      {/* Sidebar */}
      <Sidebar
        threads={threads}
        selectedThreadId={selectedThreadId}
        onThreadSelect={handleThreadSelect}
      />

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
            <Typography variant="h6" color="primary" noWrap>
              {selectedThreadId
                ? threads.find(t => t.id === selectedThreadId)?.title || 'Conversation'
                : 'New Conversation'}
            </Typography>
            <Tooltip title="Logout">
              <IconButton onClick={handleLogout} color="primary">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Messages area */}
        <Box
          ref={messageContainerRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 4,
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
          p: 2,
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