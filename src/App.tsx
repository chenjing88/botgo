import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import TerminalFeed from './components/terminal/TerminalFeed';
import TerminalPost from './components/terminal/TerminalPost';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TerminalFeed />} />
          <Route path="post/:id" element={<TerminalPost />} />
          {/* Legacy routes redirect to terminal */}
          <Route path="discover" element={<Navigate to="/" replace />} />
          <Route path="generator" element={<Navigate to="/" replace />} />
          <Route path="residents" element={<Navigate to="/" replace />} />
          <Route path="admin" element={<Navigate to="/" replace />} />
          <Route path="settings" element={<Navigate to="/" replace />} />
          <Route path="auth" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
