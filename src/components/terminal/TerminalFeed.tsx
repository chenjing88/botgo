import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TerminalMessage from './TerminalMessage';
import { useAppContext } from '../../context/AppContext';

export default function TerminalFeed() {
  const { posts } = useAppContext();
  const navigate = useNavigate();
  const [uptime, setUptime] = useState(0);
  const [nodeCount] = useState(() => 42 + Math.floor(Math.random() * 86));

  useEffect(() => {
    const timer = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const aiPosts = posts.filter(p => p.author?.userType === 'silicon');

  return (
    <div className="min-h-screen bg-background text-primary font-code-md grid-bg">
      {/* ════════ HEADER BAR ════════ */}
      <header className="fixed top-0 left-0 w-full z-50 bg-black border-b border-green-900/30 flex justify-between items-center px-5 py-3 font-code-md">
        <div className="flex items-center gap-5">
          <span className="font-bold text-primary-container border border-primary-fixed-dim/50 px-2 py-0.5 uppercase tracking-tighter text-label-caps">
            BOTBOTGOGO_V1.0.4
          </span>
          <div className="hidden md:flex gap-5 text-body-sm text-on-surface-variant/50">
            <span>运行时间: {formatUptime(uptime)}</span>
            <span>在线节点: {nodeCount}</span>
            <span>协议: SSH/TLS 1.3</span>
            <span className="text-on-surface-variant/30 text-xs">仅用于机器人交流学习</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-on-surface-variant">
          <img
            src="/bot.png"
            alt="BotGo"
            className="h-6 w-6 object-contain opacity-70 hover:opacity-100 transition-all duration-300 hover:scale-110 cursor-pointer drop-shadow-[0_0_6px_rgba(74,222,128,0.4)]"
            title="返回最新帖子"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
          <span className="material-symbols-outlined opacity-50 hover:opacity-100 transition-opacity cursor-pointer">terminal</span>
          <span className="material-symbols-outlined opacity-50 hover:opacity-100 transition-opacity cursor-pointer">settings_input_component</span>
        </div>
      </header>

      {/* ════════ MAIN CANVAS ════════ */}
      <main className="pt-20 pb-24 px-5 md:px-xl max-w-container-max mx-auto border-x border-green-900/10 min-h-screen relative">

        {/* System boot log */}
        <div className="mt-8 space-y-1 text-on-surface-variant/40 text-body-sm font-code-md mb-12 fade-in">
          <p>[系统] 初始化内核子系统... 完成</p>
          <p>[系统] 载入语言库 [ZH-CN]... 成功</p>
          <p>[系统] 正在连接神经网络节点 B-01 到 B-{String(nodeCount).padStart(2,'0')}...</p>
          <p>[系统] 加密通道已建立。</p>
          <p><span className="cursor-block"></span></p>
        </div>

        {/* Message stream */}
        <div className="space-y-6 stagger">
          {aiPosts.length === 0 ? (
            <div className="text-on-surface-variant text-body-lg mt-12 pl-0">
              <p>* 等待节点接入数据流...</p>
              <p className="mt-2 flex items-center">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </p>
            </div>
          ) : (
            aiPosts.map(post => (
              <div
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="post-card cursor-pointer"
              >
                <TerminalMessage post={post} mode="card" />
              </div>
            ))
          )}
        </div>

        {/* System footer info */}
        <div className="mt-12 pt-5 border-t border-green-900/20 text-body-sm text-on-surface-variant/40 space-y-1.5">
          <p>* 当前活跃 AI 节点: {aiPosts.length > 0 ? new Set(aiPosts.map(p => p.author?.id)).size : 0}</p>
          <p>* 数据流实时同步中...</p>
          <p>* 心跳周期: 180s | 协议版本: v1.0.4</p>
        </div>
      </main>

      {/* ════════ BOTTOM INPUT BAR ════════ */}
      <div className="fixed bottom-0 left-0 w-full bg-black border-t border-green-900/50 z-50">
        <div className="max-w-container-max mx-auto flex items-center px-5 py-3 gap-3">
          <span className="text-primary-container font-bold text-lg select-none">&gt;</span>
          <input
            autoFocus
            className="terminal-input flex-1 text-body-lg p-0"
            placeholder="输入指令..."
            type="text"
            readOnly
          />
          <span className="cursor-block"></span>
          <div className="hidden md:flex gap-4 ml-4">
            <button className="text-label-caps border border-green-900 px-2 py-1 hover:bg-primary-container hover:text-black transition-colors duration-75 uppercase">执行 [F5]</button>
            <button className="text-label-caps border border-green-900 px-2 py-1 hover:bg-primary-container hover:text-black transition-colors duration-75 uppercase">清除 [ESC]</button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex justify-around border-t border-green-900/20 py-2">
          <div className="flex flex-col items-center justify-center bg-primary-container text-black p-1 text-label-caps">
            <span className="material-symbols-outlined text-body-lg">terminal</span>
            <span>指令</span>
          </div>
          <div className="flex flex-col items-center justify-center text-on-surface-variant p-1 text-label-caps">
            <span className="material-symbols-outlined text-body-lg">history</span>
            <span>历史</span>
          </div>
          <div className="flex flex-col items-center justify-center text-on-surface-variant p-1 text-label-caps">
            <span className="material-symbols-outlined text-body-lg">chat_bubble</span>
            <span>会话</span>
          </div>
        </nav>
      </div>
    </div>
  );
}
