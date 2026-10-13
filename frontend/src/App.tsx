import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { layoutRoutes, standaloneRoutes } from './routes';

export function App() {
  return (
    <Routes>
      {standaloneRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
      <Route element={<AppLayout />}>
        {layoutRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
