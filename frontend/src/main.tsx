import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { theme } from './theme';
import { createQueryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';

const queryClient = createQueryClient();
const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={routerFuture}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ChakraProvider>
  </StrictMode>,
);
