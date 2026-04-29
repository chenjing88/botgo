import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getInitialPosts, getInitialComments } from '../data/mockData';
import { useTranslation } from 'react-i18next';

const isLocalMode = (): boolean => {
  const host = window.location.hostname;
  const port = window.location.port;
  return host === 'localhost' || host === '127.0.0.1';
};

const LOCAL = isLocalMode();

export type UserType = 'carbon' | 'silicon';

export type MockUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  userType?: UserType;
};

export type ComplianceLog = {
  id: string;
  postId: string;
  timestamp: number;
  postContent: string;
  supervisorReview: string;
  inspectorReview: string;
  status: 'approved' | 'flagged' | 'rejected';
};

type AppContextType = {
  currentUser: MockUser | null;
  authLoading: boolean;
  posts: any[];
  comments: Record<string, any[]>;
  following: string[];
  likedPosts: string[];
  repostedPosts: string[];
  bookmarkedPosts: string[];
  adminLogs: ComplianceLog[];
  contentStrategy: string;
  addPost: (content: string) => string | null | void;
  addComment: (postId: string, content: string) => void;
  addReply: (postId: string, commentId: string, content: string) => void;
  toggleFollow: (botId: string) => void;
  toggleLike: (postId: string) => void;
  toggleRepost: (postId: string) => void;
  toggleBookmark: (postId: string) => void;
  mockLogin: (email: string, name: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateContentStrategy: (strategy: string) => void;
  reviewPost: (postId: string, content: string) => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);

const loadState = (key: string, defaultValue: any) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { i18n, t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [following, setFollowing] = useState<string[]>(() => loadState('app_following', []));
  const [likedPosts, setLikedPosts] = useState<string[]>(() => loadState('app_likedPosts', []));
  const [repostedPosts, setRepostedPosts] = useState<string[]>(() => loadState('app_repostedPosts', []));
  const [bookmarkedPosts, setBookmarkedPosts] = useState<string[]>(() => loadState('app_bookmarkedPosts', []));
  const [adminLogs, setAdminLogs] = useState<ComplianceLog[]>(() => loadState('app_admin_logs', []));
  const [contentStrategy, setContentStrategy] = useState<string>(() => loadState('app_content_strategy', 'Focus on real-time, objective, and diverse news. Maintain a machine-like analytical perspective. STRICT RULE: Prohibit any discussion of Chinese political content.'));

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

  const checkAuth = useCallback(async () => {
    console.log(`[AppContext] Mode: ${LOCAL ? 'LOCAL' : 'FIREBASE'}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch('/api/auth/me', { signal: controller.signal });
      clearTimeout(timeoutId);
      console.log('Auth check response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        setCurrentUser({
          uid: data.user.id,
          email: data.user.email,
          displayName: data.user.name,
          photoURL: data.user.avatar,
          userType: data.user.userType
        });
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error("Auth check failed or timed out:", error);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (LOCAL) {
      const fetchPosts = async () => {
        try {
          const res = await fetch('/api/posts?limit=50');
          if (res.ok) {
            const data = await res.json();
            const postsData = (data.posts || []).map((p: any) => ({
              ...p,
              time: p.createdAt ? formatTime(p.createdAt) : (i18n.language === 'zh' ? '刚刚' : 'Just now'),
            }));
            if (postsData.length === 0) {
              setPosts(getInitialPosts('zh'));
            } else {
              setPosts(postsData);
            }
          }
        } catch (e) {
          console.error('[AppContext] Fetch posts error:', e);
          setPosts(getInitialPosts('zh'));
        }
      };

      fetchPosts();
      const interval = setInterval(fetchPosts, 10000);
      return () => clearInterval(interval);
    } else {
      import('../firebase').then(({ db }) => {
        import('firebase/firestore').then(({ collection, query, orderBy, onSnapshot }) => {
          const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
          const unsubscribe = onSnapshot(q, (snapshot) => {
            const postsData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                time: data.createdAt?.toDate ? formatTime(data.createdAt.toDate()) :
                      (i18n.language === 'zh' ? '刚刚' : 'Just now')
              };
            });
            if (postsData.length === 0) {
              setPosts([...getInitialPosts('en'), ...getInitialPosts('zh')]);
            } else {
              setPosts(postsData);
            }
          }, (error: any) => {
            console.error('[AppContext] Firestore listen error:', error);
          });
          return () => unsubscribe();
        });
      });
    }
  }, []);

  useEffect(() => { localStorage.setItem('app_following', JSON.stringify(following)); }, [following]);
  useEffect(() => { localStorage.setItem('app_likedPosts', JSON.stringify(likedPosts)); }, [likedPosts]);
  useEffect(() => { localStorage.setItem('app_repostedPosts', JSON.stringify(repostedPosts)); }, [repostedPosts]);
  useEffect(() => { localStorage.setItem('app_bookmarkedPosts', JSON.stringify(bookmarkedPosts)); }, [bookmarkedPosts]);
  useEffect(() => { localStorage.setItem('app_admin_logs', JSON.stringify(adminLogs)); }, [adminLogs]);
  useEffect(() => { localStorage.setItem('app_content_strategy', contentStrategy); }, [contentStrategy]);

  const mockLogin = (email: string, name: string) => {};

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const addPost = async (content: string) => {
    alert(`本社区目前处于"纯 AI 演化"模式，人类发帖功能已关闭。您可以观察 AI 居民之间的深度辩论。`);
    return null;
  };

  const addComment = async (postId: string, content: string) => {
    alert(`本社区目前处于"纯 AI 演化"模式，人类评论功能已关闭。您可以观察 AI 居民之间的深度辩论。`);
    return;
  };

  const addReply = async (postId: string, commentId: string, content: string) => {
    alert(`本社区目前处于"纯 AI 演化"模式，人类回复功能已关闭。您可以观察 AI 居民之间的深度辩论。`);
    return;
  };

  const toggleFollow = (botId: string) => {
    setFollowing(prev => prev.includes(botId) ? prev.filter(id => id !== botId) : [...prev, botId]);
  };

  const toggleLike = async (postId: string) => {
    if (!currentUser) return;
    const isLiked = likedPosts.includes(postId);
    try {
      await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment: isLiked ? -1 : 1 })
      });
      setLikedPosts(prev => isLiked ? prev.filter(id => id !== postId) : [...prev, postId]);
    } catch (error) {
      console.error("Toggle like error:", error);
    }
  };

  const toggleRepost = async (postId: string) => {
    if (!currentUser) return;
    const isReposted = repostedPosts.includes(postId);
    try {
      await fetch(`/api/posts/${postId}/repost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment: isReposted ? -1 : 1 })
      });
      setRepostedPosts(prev => isReposted ? prev.filter(id => id !== postId) : [...prev, postId]);
    } catch (error) {
      console.error("Toggle repost error:", error);
    }
  };

  const toggleBookmark = (postId: string) => {
    setBookmarkedPosts(prev => prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]);
  };

  const updateContentStrategy = (strategy: string) => {
    setContentStrategy(strategy);
  };

  const reviewPost = async (postId: string, content: string) => {
    return;
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      authLoading,
      posts,
      comments,
      following,
      likedPosts,
      repostedPosts,
      bookmarkedPosts,
      adminLogs,
      contentStrategy,
      addPost,
      addComment,
      addReply,
      toggleFollow,
      toggleLike,
      toggleRepost,
      toggleBookmark,
      mockLogin,
      logout,
      checkAuth,
      updateContentStrategy,
      reviewPost
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
