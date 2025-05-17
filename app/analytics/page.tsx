'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Container,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Divider,
  Chip,
  Pagination,
  Button,
  Stack,
  TablePagination,
  Tooltip
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';

interface AnalyticsEvent {
  id: number;
  eventType: string;
  userId: number | null;
  messageId: number | null;
  threadId: number | null;
  properties: any;
  createdAt: string;
  user?: {
    id: number;
    name: string | null;
    email: string;
  };
  message?: {
    id: number;
    contentType: string;
    senderType: string;
  };
}

interface EventCount {
  eventType: string;
  count: number;
}

interface DailyData {
  date: string;
  [key: string]: string | number;
}

interface TokenUsageData {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedCount: number;
  requestCount: number;
}

interface UserTokenUsage {
  userId: number;
  userName: string;
  totalTokens: number;
  requestCount: number;
}

interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

// Color palette for charts
const eventColors: Record<string, string> = {
  'summarize_success': '#4caf50',
  'pdf_upload': '#2196f3',
  'linkurl_analysis': '#ff9800',
  'user_login': '#9c27b0',
  'llm_token_usage': '#f44336',
  'user_registration': '#3f51b5',
  'thread_created': '#00bcd4',
  'error_occurred': '#f44336'
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<number>(3);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });
  const [summaryData, setSummaryData] = useState<EventCount[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [tokenUsageData, setTokenUsageData] = useState<TokenUsageData[]>([]);
  const [userTokenUsage, setUserTokenUsage] = useState<UserTokenUsage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics data based on selected time range
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch summary data
        const summaryResponse = await fetch(`/api/analytics?type=summary&days=${timeRange}`);
        if (!summaryResponse.ok) {
          throw new Error('Failed to fetch summary data');
        }
        const summaryJson = await summaryResponse.json();
        setSummaryData(summaryJson.data || []);
        
        // Extract unique event types for filtering
        const types = summaryJson.data.map((item: EventCount) => item.eventType);
        setEventTypes(types);
        
        // Fetch token usage data
        const tokenUsageResponse = await fetch(`/api/analytics?type=token-usage&days=${timeRange}`);
        if (!tokenUsageResponse.ok) {
          throw new Error('Failed to fetch token usage data');
        }
        const tokenUsageJson = await tokenUsageResponse.json();
        setTokenUsageData(tokenUsageJson.data || []);
        
        // Fetch user token usage data
        const userTokenResponse = await fetch(`/api/analytics?type=user-token-usage&days=${timeRange}`);
        if (!userTokenResponse.ok) {
          throw new Error('Failed to fetch user token usage data');
        }
        const userTokenJson = await userTokenResponse.json();
        setUserTokenUsage(userTokenJson.data || []);
        
        // Fetch recent events (with pagination)
        fetchEvents(1);
        
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics data. Please try again.');
        
        // Check if unauthorized and redirect to login
        if ((err as any).status === 401) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [timeRange, router]);

  // Function to fetch events with pagination
  const fetchEvents = async (page: number) => {
    try {
      const eventsResponse = await fetch(`/api/analytics?type=events&days=${timeRange}&limit=10&page=${page}&eventType=llm_token_usage`);
      if (!eventsResponse.ok) {
        throw new Error('Failed to fetch events');
      }
      const eventsJson = await eventsResponse.json();
      setEvents(eventsJson.data.events || []);
      setPagination(eventsJson.data.pagination || {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0
      });
    } catch (err) {
      console.error('Error fetching events with pagination:', err);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    fetchEvents(page);
  };

  // Prepare data for token usage line chart
  const prepareTokenUsageChart = () => {
    if (tokenUsageData.length === 0) return { xAxis: [], series: [] };
    
    // Sort by date
    const sortedData = [...tokenUsageData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return {
      xAxis: [{ 
        data: sortedData.map(day => day.date),
        scaleType: 'band'
      }],
      series: [
        {
          label: 'Total Tokens',
          data: sortedData.map(day => day.totalTokens),
          color: '#f44336'
        },
        {
          label: 'Prompt Tokens',
          data: sortedData.map(day => day.promptTokens),
          color: '#2196f3'
        },
        {
          label: 'Completion Tokens',
          data: sortedData.map(day => day.completionTokens),
          color: '#4caf50'
        }
      ]
    };
  };

  // Prepare data for cache hit rate chart
  const prepareCacheRateChart = () => {
    if (tokenUsageData.length === 0) return { xAxis: [], series: [] };
    
    // Sort by date
    const sortedData = [...tokenUsageData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return {
      xAxis: [{ 
        data: sortedData.map(day => day.date),
        scaleType: 'band'
      }],
      series: [
        {
          label: 'Cache Hit Rate (%)',
          data: sortedData.map(day => 
            day.requestCount > 0 
              ? Math.round((day.cachedCount / day.requestCount) * 100) 
              : 0
          ),
          color: '#ff9800'
        }
      ]
    };
  };

  // Prepare data for user token usage bar chart
  const prepareUserTokenChart = () => {
    if (userTokenUsage.length === 0) return { xAxis: [], series: [] };
    
    // Get top 10 users by token usage
    const topUsers = [...userTokenUsage]
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 10);
    
    return {
      xAxis: [{ 
        data: topUsers.map(user => user.userName),
        scaleType: 'band'
      }],
      series: [
        {
          data: topUsers.map(user => user.totalTokens),
          color: '#3f51b5'
        }
      ]
    };
  };

  const tokenUsageChartData = prepareTokenUsageChart();
  const cacheRateChartData = prepareCacheRateChart();
  const userTokenChartData = prepareUserTokenChart();

  // Calculate total tokens and cache hit rate for summary cards
  const calculateTokenSummary = () => {
    if (tokenUsageData.length === 0) return { totalTokens: 0, cacheRate: 0 };
    
    const totalTokens = tokenUsageData.reduce((sum, day) => sum + day.totalTokens, 0);
    
    const totalRequests = tokenUsageData.reduce((sum, day) => sum + day.requestCount, 0);
    const cachedRequests = tokenUsageData.reduce((sum, day) => sum + day.cachedCount, 0);
    
    const cacheRate = totalRequests > 0 
      ? Math.round((cachedRequests / totalRequests) * 100) 
      : 0;
    
    return { totalTokens, cacheRate };
  };

  const tokenSummary = calculateTokenSummary();

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Container>
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error}
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        LLM Usage Analytics
      </Typography>
      
      {/* Time range selector */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(Number(e.target.value))}
          >
            <MenuItem value={1}>Last 1 days</MenuItem>
            <MenuItem value={3}>Last 3 days</MenuItem>
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {/* Summary cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Tokens Used
              </Typography>
              <Typography variant="h4">
                {formatNumber(tokenSummary.totalTokens)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Cache Hit Rate
              </Typography>
              <Typography variant="h4">
                {tokenSummary.cacheRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                API Requests
              </Typography>
              <Typography variant="h4">
                {tokenUsageData.reduce((sum, day) => sum + day.requestCount, 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Avg Tokens per Request
              </Typography>
              <Typography variant="h4">
                {tokenUsageData.reduce((sum, day) => sum + day.requestCount, 0) > 0
                  ? formatNumber(Math.round(tokenSummary.totalTokens / tokenUsageData.reduce((sum, day) => sum + day.requestCount, 0)))
                  : 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Token usage charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Token usage line chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Token Usage Over Time
            </Typography>
            {tokenUsageData.length > 0 ? (
              <LineChart
                xAxis={tokenUsageChartData.xAxis}
                series={tokenUsageChartData.series}
                height={320}
              />
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography>No data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Cache hit rate chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Cache Hit Rate (%)
            </Typography>
            {tokenUsageData.length > 0 ? (
              <LineChart
                xAxis={cacheRateChartData.xAxis}
                series={cacheRateChartData.series}
                height={320}
              />
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography>No data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* User token usage bar chart */}
      <Grid container sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Token Usage by User (Top 10)
            </Typography>
            {userTokenUsage.length > 0 ? (
              <BarChart
                xAxis={userTokenChartData.xAxis}
                series={userTokenChartData.series}
                height={320}
              />
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography>No data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Recent token usage events */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">
          Recent Token Usage Events
        </Typography>
      </Box>
      
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Prompt Tokens</TableCell>
              <TableCell>Completion Tokens</TableCell>
              <TableCell>Total Tokens</TableCell>
              <TableCell>Cached</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((event) => {
              const props = event.properties || {};
              return (
                <TableRow key={event.id}>
                  <TableCell>{formatDate(event.createdAt)}</TableCell>
                  <TableCell>{event.user?.name || event.userId || 'Anonymous'}</TableCell>
                  <TableCell>{formatNumber(props.promptTokens || 0)}</TableCell>
                  <TableCell>{formatNumber(props.completionTokens || 0)}</TableCell>
                  <TableCell>{formatNumber(props.totalTokens || 0)}</TableCell>
                  <TableCell>
                    {props.cachedPromptTokens ? (
                      <Chip 
                        label="Cached" 
                        size="small"
                        sx={{ bgcolor: '#4caf50', color: 'white' }}
                      />
                    ) : (
                      <Chip 
                        label="No" 
                        size="small"
                        sx={{ bgcolor: '#bdbdbd', color: 'white' }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {events.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No token usage events found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <Pagination 
            count={pagination.totalPages} 
            page={pagination.page} 
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}
    </Container>
  );
} 