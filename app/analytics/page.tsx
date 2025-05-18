'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Chip,
  Pagination,
  Tooltip,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface AnalyticsEvent {
  id: number;
  eventType: string;
  userId: number | null;
  messageId: number | null;
  threadId: number | null;
  properties: Record<string, unknown> | string;
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

// Helper function to parse event properties consistently
const parseProperties = (event: AnalyticsEvent): Record<string, unknown> => {
  if (!event.properties) return {};
  
  try {
    return typeof event.properties === 'string'
      ? JSON.parse(event.properties)
      : event.properties as Record<string, unknown>;
  } catch (e) {
    console.error('Error parsing event properties:', e);
    return {};
  }
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `analytics-tab-${index}`,
    'aria-controls': `analytics-tabpanel-${index}`,
  };
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [tabValue, setTabValue] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<number>(3);
  const [, setEventTypes] = useState<string[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });
  const [summaryData, setSummaryData] = useState<EventCount[]>([]);
  const [tokenUsageData, setTokenUsageData] = useState<TokenUsageData[]>([]);
  const [userTokenUsage, setUserTokenUsage] = useState<UserTokenUsage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch events with pagination
  const fetchEvents = useCallback(async (page: number, eventType?: string) => {
    try {
      const targetEventType = eventType || (tabValue === 0 ? 'llm_token_usage' : 
                            tabValue === 1 ? 'pdf_upload' : 
                            tabValue === 2 ? 'linkurl_analysis' : 
                            tabValue === 3 ? 'user_login' :
                            tabValue === 4 ? 'error_occurred' : undefined);
      
      const eventsResponse = await fetch(`/api/analytics?type=events&days=${timeRange}&limit=10&page=${page}${targetEventType ? `&eventType=${targetEventType}` : ''}`);
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
  }, [tabValue, timeRange]);

  // Fetch analytics data based on selected time range and tab
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
        
        // Fetch data based on active tab
        if (tabValue === 0) {
          // Fetch token usage data for LLM Usage tab
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
        }
        
        // Fetch recent events based on active tab
        const eventTypes = [
          'llm_token_usage',
          'pdf_upload',
          'linkurl_analysis',
          'user_login',
          'error_occurred'
        ];
        
        if (tabValue >= 0 && tabValue < eventTypes.length) {
          fetchEvents(1, eventTypes[tabValue]);
        }
        
      } catch (err) {
        console.error('Error fetching analytics:', err);
        const errorMessage = 'Failed to load analytics data. Please try again.';
        setError(errorMessage);
        
        // Check if unauthorized and redirect to login
        if ((err as Error & { status?: number }).status === 401) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [timeRange, tabValue, router, fetchEvents]);

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

  // Add tab change handler
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Fetch events for the selected tab
    const eventTypes = [
      'llm_token_usage',
      'pdf_upload',
      'linkurl_analysis',
      'user_login',
      'error_occurred'
    ];
    
    if (newValue >= 0 && newValue < eventTypes.length) {
      fetchEvents(1, eventTypes[newValue]);
    }
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Analytics Dashboard
        </Typography>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => router.push('/')}>
          Back to Home
        </Button>
      </Box>
      
      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="analytics tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="LLM Usage" {...a11yProps(0)} />
          <Tab label="PDF Uploads" {...a11yProps(1)} />
          <Tab label="Link Analysis" {...a11yProps(2)} />
          <Tab label="User Activity" {...a11yProps(3)} />
          <Tab label="Errors" {...a11yProps(4)} />
        </Tabs>
      </Box>
      
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
      
      {/* LLM Usage Tab */}
      <TabPanel value={tabValue} index={0}>
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
                const props = parseProperties(event);
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
      </TabPanel>
      
      {/* PDF Uploads Tab */}
      <TabPanel value={tabValue} index={1}>
        {/* Summary cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total PDF Uploads
                </Typography>
                <Typography variant="h4">
                  {summaryData.find(item => item.eventType === 'pdf_upload')?.count || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Average File Size
                </Typography>
                <Typography variant="h4">
                  {events.length > 0 
                    ? formatNumber(Math.round(events.reduce((sum, event) => 
                        sum + (parseProperties(event)?.fileSize || 0), 0) / events.length)) + ' KB'
                    : '0 KB'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Avg Content Length
                </Typography>
                <Typography variant="h4">
                  {events.length > 0 
                    ? formatNumber(Math.round(events.reduce((sum, event) => 
                        sum + (parseProperties(event)?.contentLength || 0), 0) / events.length))
                    : '0'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Uploads Today
                </Typography>
                <Typography variant="h4">
                  {events.filter(event => {
                    const today = new Date();
                    const eventDate = new Date(event.createdAt);
                    return today.toDateString() === eventDate.toDateString();
                  }).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent PDF upload events */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">
            Recent PDF Uploads
          </Typography>
        </Box>
        
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>User</TableCell>
                <TableCell>File Name</TableCell>
                <TableCell>File Size (KB)</TableCell>
                <TableCell>Content Length</TableCell>
                <TableCell>Thread ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => {
                const props = parseProperties(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell>{formatDate(event.createdAt)}</TableCell>
                    <TableCell>{event.user?.name || event.userId || 'Anonymous'}</TableCell>
                    <TableCell>{props.fileName || 'Unnamed'}</TableCell>
                    <TableCell>{formatNumber(props.fileSize ? Math.round(props.fileSize / 1024) : 0)}</TableCell>
                    <TableCell>{formatNumber(props.contentLength || 0)}</TableCell>
                    <TableCell>{event.threadId || 'N/A'}</TableCell>
                  </TableRow>
                );
              })}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No PDF upload events found
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
      </TabPanel>
      
      {/* Link Analysis Tab */}
      <TabPanel value={tabValue} index={2}>
        {/* Summary cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Link Analyses
                </Typography>
                <Typography variant="h4">
                  {summaryData.find(item => item.eventType === 'linkurl_analysis')?.count || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Average Content Length
                </Typography>
                <Typography variant="h4">
                  {events.length > 0 
                    ? formatNumber(Math.round(events.reduce((sum, event) => 
                        sum + (parseProperties(event)?.contentLength || 0), 0) / events.length))
                    : '0'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Links Today
                </Typography>
                <Typography variant="h4">
                  {events.filter(event => {
                    const today = new Date();
                    const eventDate = new Date(event.createdAt);
                    return today.toDateString() === eventDate.toDateString();
                  }).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Success Rate
                </Typography>
                <Typography variant="h4">
                  {events.length > 0 
                    ? Math.round(events.filter(event => 
                        parseProperties(event)?.success === true).length / events.length * 100) + '%'
                    : '0%'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent link analysis events */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">
            Recent Link Analyses
          </Typography>
        </Box>
        
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>User</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Content Length</TableCell>
                <TableCell>Thread ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => {
                const props = parseProperties(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell>{formatDate(event.createdAt)}</TableCell>
                    <TableCell>{event.user?.name || event.userId || 'Anonymous'}</TableCell>
                    <TableCell>
                      <Tooltip title={props.url || 'Unknown'}>
                        <Typography noWrap sx={{ maxWidth: 250 }}>
                          {props.url || 'Unknown'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{formatNumber(props.contentLength || 0)}</TableCell>
                    <TableCell>{event.threadId || 'N/A'}</TableCell>
                  </TableRow>
                );
              })}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No link analysis events found
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
      </TabPanel>
      
      {/* User Activity Tab */}
      <TabPanel value={tabValue} index={3}>
        {/* Summary cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Logins
                </Typography>
                <Typography variant="h4">
                  {summaryData.find(item => item.eventType === 'user_login')?.count || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Logins Today
                </Typography>
                <Typography variant="h4">
                  {events.filter(event => {
                    const today = new Date();
                    const eventDate = new Date(event.createdAt);
                    return today.toDateString() === eventDate.toDateString();
                  }).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Active Users
                </Typography>
                <Typography variant="h4">
                  {events.reduce((users, event) => {
                    if (event.userId && !users.includes(event.userId)) {
                      users.push(event.userId);
                    }
                    return users;
                  }, [] as number[]).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Unique Devices
                </Typography>
                <Typography variant="h4">
                  {events.reduce((devices, event) => {
                    const props = parseProperties(event);
                    if (props.deviceId && !devices.includes(props.deviceId)) {
                      devices.push(props.deviceId);
                    }
                    return devices;
                  }, [] as string[]).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent user login events */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">
            Recent Login Activity
          </Typography>
        </Box>
        
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>User</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => {
                const props = parseProperties(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell>{formatDate(event.createdAt)}</TableCell>
                    <TableCell>{event.user?.email || event.userId || 'Anonymous'}</TableCell>
                  </TableRow>
                );
              })}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No user login events found
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
      </TabPanel>
      
      {/* Errors Tab */}
      <TabPanel value={tabValue} index={4}>
        {/* Summary cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Errors
                </Typography>
                <Typography variant="h4">
                  {summaryData.find(item => item.eventType === 'error_occurred')?.count || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Errors Today
                </Typography>
                <Typography variant="h4">
                  {events.filter(event => {
                    const today = new Date();
                    const eventDate = new Date(event.createdAt);
                    return today.toDateString() === eventDate.toDateString();
                  }).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Most Common Error
                </Typography>
                <Typography variant="h4" sx={{ fontSize: '1.5rem' }}>
                  {events.length > 0 
                    ? (() => {
                        const counts = events.reduce((counts, event) => {
                          const props = parseProperties(event);
                          const errorType = props.errorType || 'Unknown';
                          counts[errorType] = (counts[errorType] || 0) + 1;
                          return counts;
                        }, {} as Record<string, number>);
                        const entries = Object.entries(counts);
                        return entries.sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';
                      })()
                    : 'None'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Affected Users
                </Typography>
                <Typography variant="h4">
                  {events.reduce((users, event) => {
                    if (event.userId && !users.includes(event.userId)) {
                      users.push(event.userId);
                    }
                    return users;
                  }, [] as number[]).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent error events */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">
            Recent Errors
          </Typography>
        </Box>
        
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Error Type</TableCell>
                <TableCell>errorStatus</TableCell>
                <TableCell>Location</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => {
                const props = parseProperties(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell>{formatDate(event.createdAt)}</TableCell>
                    <TableCell>{event.user?.name || event.userId || 'Anonymous'}</TableCell>
                    <TableCell>{props.errorType || 'Unknown'}</TableCell>
                    <TableCell>
                      <Tooltip title={props.message || 'Unknown'}>
                        <Typography noWrap sx={{ maxWidth: 250 }}>
                          {props.errorMessage || 'Unknown'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{props.errorStatus || 'Unknown'}</TableCell>
                  </TableRow>
                );
              })}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No error events found
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
      </TabPanel>
    </Container>
  );
} 