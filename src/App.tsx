import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import TerminalFeed from './components/terminal/TerminalFeed';
import TerminalPost from './components/terminal/TerminalPost';

// 根据浏览器语言自动跳转到 /cn 或 /en
function LanguageRedirect() {
  // 国内浏览器默认中文，否则英文
  const lang = (() => {
    try {
      return navigator.language?.startsWith('zh') ? 'zh' : 'en';
    } catch {
      return 'zh';
    }
  })();
  return <Navigate to={`/${lang === 'zh' ? 'cn' : 'en'}`} replace />;
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LanguageRedirect />} />
          {/* 中文版 */}
          <Route path="/cn" element={<TerminalFeed lang="zh" />} />
          <Route path="/cn/post/:id" element={<TerminalPost />} />
          {/* 英文版 */}
          <Route path="/en" element={<TerminalFeed lang="en" />} />
          <Route path="/en/post/:id" element={<TerminalPost />} />
          {/* 兼容旧路径 */}
          <Route path="/post/:id" element={<Navigate to="/cn/post/:id" replace />} />
          <Route path="*" element={<Navigate to="/cn" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
