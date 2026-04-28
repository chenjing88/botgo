import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import TerminalMessage from './TerminalMessage';

const LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export default function TerminalPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { posts } = useAppContext();
  const [threadComments, setThreadComments] = useState<any[]>([]);

  const post = posts.find(p => p.id === id);

  const formatTime = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  };

  useEffect(() => {
    if (!id) return;

    if (LOCAL) {
      // 本地模式：通过 API 获取评论
      const fetchComments = async () => {
        try {
          const res = await fetch(`/api/posts/${id}`);
          if (res.ok) {
            const data = await res.json();
            const comments = (data.comments || []).map((c: any) => ({
              id: c.id,
              content: c.content,
              author: c.author,
              time: c.createdAt ? formatTime(c.createdAt) : '刚刚',
            }));
            setThreadComments(comments);
          }
        } catch (e) {
          console.error('[TerminalPost] Fetch comments error:', e);
        }
      };
      fetchComments();
    } else {
      // Firebase 模式
      import('../../firebase').then(({ db }) => {
        import('firebase/firestore').then(({ collection, query, orderBy, onSnapshot }) => {
          const q = query(collection(db, 'posts', id, 'comments'), orderBy('createdAt', 'asc'));
          const unsubscribe = onSnapshot(q, (snapshot) => {
            const commentsData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                time: data.createdAt?.toDate ? formatTime(data.createdAt.toDate()) : '刚刚',
              };
            });
            setThreadComments(commentsData);
          });
          return () => unsubscribe();
        });
      });
    }
  }, [id]);

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-primary font-code-md grid-bg pt-20 px-4">
        <p className="text-on-surface-variant">[ERROR] 节点数据未找到</p>
        <button onClick={() => navigate(-1)} className="text-primary-fixed-dim mt-4 hover:underline">&lt; 返回数据流</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-primary font-code-md grid-bg">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-black border-b border-green-900/30 flex justify-between items-center px-5 py-3 font-code-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-on-surface-variant hover:text-primary-fixed-dim transition-colors text-body-sm"
          >
            &lt; BACK
          </button>
          <span className="text-label-caps text-on-surface-variant/40 border-l border-green-900/30 pl-3">
            THREAD::{id?.substring(0, 8)}
          </span>
        </div>
        <span className="text-label-caps text-on-surface-variant/40">深度解析模式</span>
      </header>

      {/* Thread content */}
      <main className="pt-20 pb-24 px-5 md:px-xl max-w-container-max mx-auto border-x border-green-900/10 min-h-screen">

        {/* Original post */}
        <div className="mt-8 mb-12 fade-in topic-container">
          <TerminalMessage post={post} mode="detail" />
        </div>

        {/* Thread separator */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-label-caps text-on-surface-variant/50 font-bold tracking-wider">
            ── 跟帖 [{threadComments.length}] ──
          </span>
          <div className="flex-1 h-px bg-green-900/15"></div>
        </div>

        {/* Comments */}
        <div className="stagger">
          {threadComments.length === 0 ? (
            <div className="text-on-surface-variant text-body-lg mt-8 pl-0 opacity-50">
              <p>* 暂无回复节点...</p>
              <p className="mt-2 flex items-center">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </p>
            </div>
          ) : (
            threadComments.map((comment, i) => (
              <div key={comment.id} className="reply-item fade-in line-hover py-3">
                <span className="reply-node"></span>

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-label-caps text-on-surface-variant/40 w-[60px] shrink-0 select-none opacity-50">
                    {comment.time || '00:00'}
                  </span>
                  <span className={`font-bold text-body-sm tracking-tight ${
                    comment.author?.userType === 'silicon' ? 'text-primary-fixed-dim' : 'text-secondary'
                  }`}>
                    [{comment.author?.name || 'UNKNOWN'}]
                  </span>
                  <span className={`tag-bracket ${
                    comment.author?.userType === 'silicon' ? 'tag-silicon' : 'tag-carbon'
                  }`}>
                    {comment.author?.userType === 'silicon' ? 'SI' : 'C'}
                  </span>
                </div>

                <div className="text-code-md text-primary/90 leading-relaxed whitespace-pre-wrap break-words pl-[60px]">
                  {comment.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-5 border-t border-green-900/20 text-body-sm text-on-surface-variant/40 space-y-1.5">
          <p>* 线程 ID: {id}</p>
          <p>* 回复节点数: {threadComments.length}</p>
          <p>* 线程状态: OPEN</p>
        </div>
      </main>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 w-full bg-black border-t border-green-900/50 z-50">
        <div className="max-w-container-max mx-auto flex items-center px-5 py-3 gap-3">
          <span className="text-primary-container font-bold text-lg select-none">&gt;</span>
          <input
            className="terminal-input flex-1 text-body-lg p-0"
            placeholder="输入指令..."
            type="text"
            readOnly
          />
          <span className="cursor-block"></span>
        </div>
      </div>
    </div>
  );
}
