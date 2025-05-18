'use client';

import { Box, Typography, Button, Paper } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useRouter } from 'next/navigation';
import { useTheme } from '@mui/material';

// This page is just a static placeholder that informs users about the new location
export default function DashboardPage() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: theme.palette.background.default
    }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          maxWidth: 500, 
          textAlign: 'center',
          borderTop: `4px solid ${theme.palette.primary.main}`
        }}
      >
        <Typography variant="h4" component="h1" sx={{ mb: 2, color: theme.palette.primary.main }}>
          Page Moved
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 4 }}>
          The dashboard has been relocated to the home page. All your conversations and features are now available there.
        </Typography>
        
        <Button 
          variant="contained" 
          color="primary"
          size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={() => router.push('/')}
        >
          Go to Home Page
        </Button>
      </Paper>
    </Box>
  );
}