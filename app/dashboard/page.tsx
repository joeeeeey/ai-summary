'use client';

import { Box, Typography, Button, Paper, useTheme, useMediaQuery } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useRouter } from 'next/navigation';

// This page is just a static placeholder that informs users about the new location
export default function DashboardPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: theme.palette.background.default,
      padding: { xs: 2, sm: 0 }
    }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: { xs: 3, sm: 4 }, 
          maxWidth: { xs: '100%', sm: 500 }, 
          width: { xs: '100%', sm: 'auto' },
          textAlign: 'center',
          borderTop: `4px solid ${theme.palette.primary.main}`
        }}
      >
        <Typography 
          variant={isMobile ? "h5" : "h4"} 
          component="h1" 
          sx={{ mb: 2, color: theme.palette.primary.main }}
        >
          Page Moved
        </Typography>
        
        <Typography 
          variant="body1" 
          sx={{ 
            mb: { xs: 3, sm: 4 },
            fontSize: { xs: '0.95rem', sm: '1rem' }  
          }}
        >
          The dashboard has been relocated to the home page. All your conversations and features are now available there.
        </Typography>
        
        <Button 
          variant="contained" 
          color="primary"
          size={isMobile ? "medium" : "large"}
          endIcon={<ArrowForwardIcon />}
          onClick={() => router.push('/')}
          fullWidth={isMobile}
        >
          Go to Home Page
        </Button>
      </Paper>
    </Box>
  );
}