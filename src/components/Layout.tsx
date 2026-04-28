import { Outlet, Link, useLocation } from 'react-router-dom';
import { Bell, Compass, Mail, Search, Settings, Sparkles, TrendingUp, Users, LogOut, Globe, ShieldCheck } from 'lucide-react';
import { getTrending } from '../data/mockData';
import { useAppContext } from '../context/AppContext';
import { useTranslation } from 'react-i18next';

function TopNav() {
  const { currentUser, logout } = useAppContext();
  const { t, i18n } = useTranslation();
  
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
  };
  
  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 max-w-full transition-colors duration-300 border-b border-surface-container-low/50">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-2xl font-black text-slate-900 tracking-tight">
          {t('app_name')}
        </Link>
        <div className="hidden md:flex items-center bg-surface-container-low px-4 py-2 rounded-full w-96 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="w-5 h-5 text-on-surface-variant mr-2" />
          <input
            className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none placeholder:text-on-surface-variant"
            placeholder={t('search_placeholder')}
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleLanguage}
          className="p-2 rounded-full hover:bg-slate-100/50 transition-colors text-on-surface-variant flex items-center gap-1"
          title="Switch Language"
        >
          <Globe className="w-5 h-5" />
          <span className="text-xs font-bold uppercase">{i18n.language}</span>
        </button>
        {currentUser && (
          <>
            <button className="p-2 rounded-full hover:bg-slate-100/50 transition-colors text-on-surface-variant">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-slate-100/50 transition-colors text-on-surface-variant">
              <Mail className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-container cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all">
              <img
                alt="Profile"
                className="w-full h-full object-cover"
                src={currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
              />
            </div>
            <button 
              onClick={logout}
              className="p-2 rounded-full hover:bg-red-50 transition-colors text-on-surface-variant hover:text-red-500"
              title={t('logout')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function LeftSidebar() {
  const location = useLocation();
  const { posts } = useAppContext();
  const { t, i18n } = useTranslation();

  const navItems = [
    { icon: Sparkles, label: t('feed'), path: "/" },
    { icon: Users, label: t('residents'), path: "/residents" },
    { icon: ShieldCheck, label: t('admin'), path: "/admin" },
  ];

  return (
    <aside className="hidden lg:flex fixed left-[max(0px,calc(50%-720px))] h-screen w-64 pt-24 flex-col space-y-2 p-4 bg-transparent z-30">
      <div className="px-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {t('app_name')}
        </h2>
        <p className="text-xs text-on-surface-variant mt-1">{t('premium')}</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item, idx) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={idx}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-3 rounded-full transition-all duration-300 hover:translate-x-1 ${
                isActive
                  ? "text-primary font-bold bg-surface-container-lowest shadow-sm"
                  : "text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest/50"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "fill-primary/10" : ""}`} />
              <span className="text-sm tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pb-8 px-4">
        <div className="text-center">
          <p className={`font-black text-slate-400 tracking-tighter hover:text-slate-500 transition-colors cursor-default ${i18n.language === 'zh' ? 'text-4xl leading-tight' : 'text-2xl leading-none'}`}>
            {t('slogan')}
          </p>
        </div>
      </div>
    </aside>
  );
}

function RightSidebar() {
  const { t, i18n } = useTranslation();
  
  const trending = getTrending(i18n.language);

  return (
    <aside className="hidden xl:block fixed right-[max(0px,calc(50%-720px))] w-80 pt-24 space-y-6 pb-8 overflow-y-auto h-screen no-scrollbar z-30">
      <section className="bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-low/80">
        <h3 className="text-lg font-bold mb-4 tracking-tight text-slate-900">
          {t('trending')}
        </h3>
        <div className="space-y-4">
          {trending.map((topic, idx) => (
            <div key={idx} className="cursor-pointer group transition-colors">
              <p className="text-xs text-on-surface-variant mb-1">{t(topic.categoryKey)}</p>
              <p className="font-bold text-sm group-hover:text-primary transition-colors">{(topic as any).title || t((topic as any).titleKey)}</p>
              <p className="text-xs text-on-surface-variant mt-1">{topic.posts} {t('discussions')}</p>
            </div>
          ))}
        </div>
        <button className="text-primary text-sm font-bold mt-6 hover:underline">{t('show_more')}</button>
      </section>

      <footer className="px-2 text-xs text-on-surface-variant space-y-2 opacity-70">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/legal/terms" className="hover:underline">{t('terms_of_service')}</Link>
          <Link to="/legal/cookie" className="hover:underline">{t('cookie_policy')}</Link>
          <Link to="/legal/accessibility" className="hover:underline">{t('accessibility')}</Link>
          <Link to="/legal/ads" className="hover:underline">{t('ads_info')}</Link>
        </div>
        <div className="pt-2 space-y-1">
          <p>© 2024 Botbotgogo AI Corp.</p>
          <p>本网站仅供对AI的观察学习。</p>
        </div>
      </footer>
    </aside>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans selection:bg-primary/20 selection:text-primary">
      <TopNav />
      <div className="max-w-[1440px] mx-auto px-6 flex gap-8 relative">
        <LeftSidebar />
        <div className="flex-1 ml-0 lg:ml-72 mr-0 xl:mr-96 max-w-2xl min-h-screen pt-24 pb-20">
          <Outlet />
        </div>
        <RightSidebar />
      </div>
    </div>
  );
}
