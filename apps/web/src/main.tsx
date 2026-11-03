import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { queryClient } from './api/queryClient';
import { AuthProvider } from './auth/AuthContext';
import { EcoSoftThemeProvider } from './theme/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EcoSoftThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </EcoSoftThemeProvider>
  </StrictMode>,
);
