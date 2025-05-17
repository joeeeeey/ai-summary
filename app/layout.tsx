'use client';

import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const theme = createTheme({
  palette: {
    primary: {
      main: '#1A237E', // 深藍色 (Kon-iro)
      light: '#4A5BC4', // 瑠璃色 (Ruri-iro)
      dark: '#0F1444',
    },
    secondary: {
      main: '#4FC3F7', // 水色 (Mizu-iro)
    },
    background: {
      default: '#F7FAFC',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: [
      'var(--font-geist-sans)',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
    fontFamilyMonospace: 'var(--font-geist-mono)',
  },
  shape: {
    borderRadius: 8,
  },
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
