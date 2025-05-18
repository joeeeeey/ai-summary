'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Alert,
  useTheme
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

export default function LoginPage() {
  const router = useRouter();
  const theme = useTheme();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    console.log('Login submission started');

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Invalid email format.');
        setIsSubmitting(false);
        return;
      }

      console.log('Making API request to /api/login');
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'same-origin' // Ensure cookies are sent and received
      });

      console.log('API response received:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        setError(data.error || 'Login failed.');
      } else {
        console.log('Login successful, redirecting to home');
        router.push('/');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            borderTop: `4px solid ${theme.palette.primary.main}`,
          }}
        >
          <Box
            sx={{
              backgroundColor: theme.palette.primary.main,
              width: 50,
              height: 50,
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 2,
            }}
          >
            <LockOutlinedIcon sx={{ color: 'white' }} />
          </Box>

          <Typography component="h1" variant="h5" sx={{ mb: 3, color: theme.palette.primary.main }}>
            Login
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={isSubmitting}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={isSubmitting}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isSubmitting}
              sx={{
                py: 1.5,
                backgroundColor: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
              }}
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                variant="text"
                size="small"
                onClick={() => router.push('/register')}
                disabled={isSubmitting}
                sx={{ color: theme.palette.primary.main }}
              >
                Don&apos;t have an account? Register
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}