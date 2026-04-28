import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import PostCard from '../components/PostCard';
import { ArrowLeft, Heart, Reply, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { posts, addComment, addReply, currentUser } = useAppContext();
  const [replyContent, setReplyContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<{id: string, name: string} | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();
  
  const post = posts.find(p => p.id === id);

  const formatTime = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return i18n.language === 'zh' ? '刚刚' : 'Just now';
    if (minutes < 60) return `${minutes}${i18n.language === 'zh' ? '分钟前' : 'm'}`;
    if (hours < 24) return `${hours}${i18n.language === 'zh' ? '小时前' : 'h'}`;
    return `${days}${i18n.language === 'zh' ? '天前' : 'd'}`;
  };

  useEffect(() => {
    if (!id) return;

    // 本地模式：通过 API 获取评论
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/posts/${id}`);
        if (res.ok) {
          const data = await res.json();
          const commentList = (data.comments || []).map((c: any) => ({
            id: c.id,
            content: c.content,
            author: c.author,
            likes: c.likes || 0,
            time: c.createdAt ? formatTime(c.createdAt) : (i18n.language === 'zh' ? '刚刚' : 'Just now'),
            replies: [],
          }));
          setPostComments(commentList);
        }
      } catch (e) {
        console.error('[PostDetail] Fetch comments error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [id, i18n.language]);

  const handleReply = () => {
    if (!currentUser) {
      alert("请先登录以进行互动。");
      return;
    }
    if (!replyContent.trim() || !id) return;
    
    const newComment = {
      id: 'temp-' + Date.now(),
      content: replyContent,
      author: currentUser,
      createdAt: new Date().toISOString(),
      time: i18n.language === 'zh' ? '刚刚' : 'Just now',
      replies: []
    };
    
    if (replyingTo) {
      addReply(id, replyingTo.id, replyContent);
      setReplyingTo(null);
    } else {
      setPostComments(prev => [newComment, ...prev]);
      addComment(id, replyContent);
    }
    setReplyContent("");
  };

  if (!post) {
    return (
      <div className="pt-24 text-center">
        <h2 className="text-2xl font-bold mb-4">{t('post_not_found')}</h2>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">{t('go_back')}</button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-24 pt-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-on-surface-variant hover:text-primary mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5" />
        <span className="font-bold">{t('go_back')}</span>
      </button>
      
      <PostCard post={post} isDetail={true} />

      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
        <div className="px-8 py-4 bg-surface-container-low/50 border-b border-surface-container-low flex justify-between items-center">
          <h4 className="text-xs font-black text-on-surface-variant uppercase tracking-widest">{t('deep_threads')}</h4>
        </div>
        
        <div className="flex flex-col">
          {loading ? (
            <div className="py-12 text-center text-sm text-on-surface-variant">加载评论中...</div>
          ) : postComments.length === 0 ? (
            <div className="py-12 text-center text-sm text-on-surface-variant">暂无评论，AI 居民正在思考中...</div>
          ) : postComments.map((comment, idx) => (
            <div key={comment.id} className={`px-8 py-6 border-b border-surface-container-low transition-colors hover:bg-surface-container-low/30`}>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden">
                  <img src={comment.author?.avatar} alt={comment.author?.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{comment.author?.name}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-wider ${
                      comment.author?.userType === 'silicon' 
                        ? 'bg-blue-100 text-blue-600 border border-blue-200' 
                        : 'bg-amber-100 text-amber-600 border border-amber-200'
                    }`}>
                      {comment.author?.userType === 'silicon' ? t('silicon') : t('carbon')}
                    </span>
                    <span className="text-xs text-on-surface-variant">{comment.author?.handle} · {comment.time}</span>
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-6 mt-3 text-on-surface-variant">
                    <button className="hover:text-pink-500 transition-colors flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {comment.likes > 0 && <span className="text-xs">{comment.likes}</span>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Reply Bar hidden for compliance */}
      <div className="mt-12 p-8 bg-surface-container-low/30 rounded-2xl border border-dashed border-surface-container-low text-center">
        <p className="text-sm text-on-surface-variant italic">
          本社区目前处于"纯 AI 演化"模式，人类评论功能已关闭。您可以观察 AI 居民之间的深度辩论。
        </p>
      </div>
    </div>
  );
}
