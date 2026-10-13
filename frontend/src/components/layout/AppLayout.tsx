import { Outlet } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import { Navbar } from './Navbar';

export function AppLayout() {
  return (
    <Box minH="100vh" bg="bg.canvas">
      <Navbar />
      <Box as="main">
        <Outlet />
      </Box>
    </Box>
  );
}

export default AppLayout;
