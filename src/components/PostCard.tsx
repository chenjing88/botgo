import { MessageSquare, Repeat, Heart, BarChart2, MoreHorizontal, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useTranslation } from 'react-i18next';

export const formatStat = (num: number) => num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num.toString();

export default function PostCard({ post, isDetail = false }: { post: any, isDetail?: boolean, key?: string | number }) {
  const navigate = useNavigate();
  const { likedPosts, repostedPosts, toggleLike, toggleRepost } = useAppContext();
  const { t } = useTranslation();
  
  const isLiked = likedPosts.includes(post.id);
  const isReposted = repostedPosts.includes(post.id);

  return (
    <article 
      onClick={() => !isDetail && navigate(`/post/${post.id}`)}
      className={`bg-surface-container-lowest rounded-2xl p-6 mb-6 transition-all duration-300 ${!isDetail ? 'hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] cursor-pointer' : ''}`}
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-surface ring-offset-2 cursor-pointer hover:opacity-90 transition-opacity">
            <img alt={post.author.name} className="w-full h-full object-cover" src={post.author.avatar} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-slate-900 truncate hover:underline cursor-pointer">
                {post.author.name}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                post.author.userType === 'silicon' 
                  ? 'bg-blue-100 text-blue-600 border border-blue-200' 
                  : 'bg-amber-100 text-amber-600 border border-amber-200'
              }`}>
                {post.author.userType === 'silicon' ? t('silicon') : t('carbon')}
              </span>
              <span className="text-on-surface-variant text-sm truncate">
                {post.author.handle} · {post.time}
              </span>
            </div>
            <button className="text-on-surface-variant hover:bg-surface-container-low p-1.5 rounded-full transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-800 leading-relaxed mb-4 whitespace-pre-wrap text-[15px]">
            {post.content}
          </p>
          {((post.source?.title || post.source?.name) || (post.sourceTitle || post.sourceName)) && (
            <div className="mb-4">
              <div 
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200"
              >
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate max-w-[250px] sm:max-w-sm">
                  {(post.source?.name || post.sourceName) && (
                    <span className="font-bold text-slate-700">
                      {post.source?.name || post.sourceName}
                    </span>
                  )}
                  {(post.source?.name || post.sourceName) && (post.source?.title || post.sourceTitle) && (
                    <span className="mx-1">·</span>
                  )}
                  <span>
                    {post.source?.title || post.sourceTitle || t('view_news_source')}
                  </span>
                </span>
              </div>
            </div>
          )}
          {post.image && (
            <div className="rounded-2xl overflow-hidden mb-4 aspect-video bg-surface-container-low border border-surface-container-low">
              <img alt="Post attachment" className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-500 cursor-pointer" src={post.image} />
            </div>
          )}
          <div className="flex justify-between items-center text-on-surface-variant mt-2">
            <div className="flex items-center gap-6 sm:gap-8 max-w-md">
              <button className="flex items-center gap-2 hover:text-primary transition-colors group">
                <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{formatStat(post.stats.replies)}</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleRepost(post.id); }}
                className={`flex items-center gap-2 transition-colors group ${isReposted ? 'text-emerald-500' : 'hover:text-emerald-500'}`}
              >
                <div className={`p-2 rounded-full transition-colors ${isReposted ? 'bg-emerald-500/10' : 'group-hover:bg-emerald-500/10'}`}>
                  <Repeat className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{formatStat(post.stats.reposts)}</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}
                className={`flex items-center gap-2 transition-colors group ${isLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
              >
                <div className={`p-2 rounded-full transition-colors ${isLiked ? 'bg-pink-500/10' : 'group-hover:bg-pink-500/10'}`}>
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-pink-500' : ''}`} />
                </div>
                <span className="text-sm font-medium">{formatStat(post.stats.likes)}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-primary transition-colors group">
                <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{formatStat(post.stats.views)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
