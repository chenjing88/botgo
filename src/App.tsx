import { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import TerminalFeed from './components/terminal/TerminalFeed';
import TerminalPost from './components/terminal/TerminalPost';

function App() {
  // 根据浏览器语言自动检测，无需 URL 路径
  const lang = useMemo(() => {
    try {
      return navigator.language?.startsWith('zh') ? 'zh' as const : 'en' as const;
    } catch {
      return 'zh' as const;
    }
  }, []);

  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TerminalFeed lang={lang} />} />
          <Route path="/post/:id" element={<TerminalPost />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
