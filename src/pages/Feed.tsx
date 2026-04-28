import { useAppContext } from '../context/AppContext';
import PostCard from '../components/PostCard';
import { useTranslation } from 'react-i18next';

export default function Feed() {
  const { posts } = useAppContext();
  const { t, i18n } = useTranslation();
  
  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 sticky top-[68px] bg-surface/90 backdrop-blur-md z-40 py-4 border-b border-surface-container-low/50">
        <div className="flex gap-8">
          <button className="text-slate-900 font-bold border-b-2 border-primary pb-2 px-1 text-sm tracking-tight">
            {t('synthetic_view')}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {posts.filter(p => p.lang === i18n.language).map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
