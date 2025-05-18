import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Typography, 
  List, 
  ListItemButton, 
  ListItemIcon,
  ListItemText,
  Button, 
  Paper,
  Divider,
  useTheme,
  useMediaQuery,
  IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';

interface Thread {
  id: number;
  title: string;
}

interface SidebarProps {
  threads: Thread[];
  selectedThreadId: number | null;
  onThreadSelect: (threadId: number | null) => void;
  onClose?: () => void; // Optional prop for mobile drawer close
}

export default function Sidebar({ threads, selectedThreadId, onThreadSelect, onClose }: SidebarProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        width: '280px',
        borderRight: `1px solid ${theme.palette.divider}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.default,
      }}
    >
      <Box sx={{ 
        p: 2, 
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Typography 
          variant={isMobile ? "subtitle1" : "h6"} 
          fontWeight="500" 
          color={theme.palette.primary.main}
        >
          Conversations
        </Typography>
        {isMobile && onClose && (
          <IconButton 
            size="small" 
            onClick={onClose}
            sx={{ ml: 1 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      
      <Divider />
      
      {/* Thread list with scrolling */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List sx={{ p: 0 }}>
          {threads.map((thread) => (
            <ListItemButton
              key={thread.id}
              selected={selectedThreadId === thread.id}
              onClick={() => onThreadSelect(thread.id)}
              sx={{
                py: isMobile ? 1 : 1.5,
                borderRadius: '4px',
                mx: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  }
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                }
              }}
            >
              <ChatIcon 
                sx={{ mr: 1 }} 
                color={selectedThreadId === thread.id ? 'inherit' : 'action'} 
                fontSize={isMobile ? "small" : "medium"}
              />
              <ListItemText 
                primary={thread.title} 
                primaryTypographyProps={{ 
                  noWrap: true,
                  fontSize: isMobile ? '0.85rem' : '0.9rem',
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
      
      {/* Action area at bottom */}
      <Box sx={{ p: isMobile ? 1.5 : 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon fontSize={isMobile ? "small" : "medium"} />}
          onClick={() => onThreadSelect(null)}
          sx={{
            py: isMobile ? 0.75 : 1,
            backgroundColor: theme.palette.primary.main,
            color: 'white',
            textTransform: 'none',
            fontSize: isMobile ? '0.85rem' : '0.9rem',
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
            }
          }}
        >
          New Chat
        </Button>
      </Box>
    </Paper>
  );
} 