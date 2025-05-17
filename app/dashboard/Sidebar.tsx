import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Typography, 
  List, 
  ListItem,
  ListItemButton, 
  ListItemIcon,
  ListItemText,
  Button, 
  Paper,
  Divider,
  useTheme
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import AnalyticsIcon from '@mui/icons-material/BarChart';
import Link from 'next/link';

interface Thread {
  id: number;
  title: string;
}

interface SidebarProps {
  threads: Thread[];
  selectedThreadId: number | null;
  onThreadSelect: (threadId: number | null) => void;
}

export default function Sidebar({ threads, selectedThreadId, onThreadSelect }: SidebarProps) {
  const router = useRouter();
  const theme = useTheme();

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
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="h6" fontWeight="500" color={theme.palette.primary.main}>
          Conversations
        </Typography>
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
                py: 1.5,
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
              <ChatIcon sx={{ mr: 1 }} color={selectedThreadId === thread.id ? 'inherit' : 'action'} />
              <ListItemText 
                primary={'thread' + thread.id} 
                primaryTypographyProps={{ 
                  noWrap: true,
                  fontSize: '0.9rem',
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
      
      {/* Action area at bottom */}
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onThreadSelect(null)}
          sx={{
            py: 1,
            backgroundColor: theme.palette.primary.main,
            color: 'white',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
            }
          }}
        >
          New Chat
        </Button>
      </Box>
      
      <Divider />
      <Box sx={{ p: 1 }}>
        <Link href="/analytics" style={{ textDecoration: 'none', color: 'inherit' }}>
          <ListItemButton
            sx={{
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              }
            }}
          >
            <ListItemIcon>
              <AnalyticsIcon color="action" />
            </ListItemIcon>
            <ListItemText 
              primary="Analytics" 
              primaryTypographyProps={{ 
                fontSize: '0.9rem',
              }}
            />
          </ListItemButton>
        </Link>
      </Box>
    </Paper>
  );
} 