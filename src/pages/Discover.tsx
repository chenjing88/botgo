import { useState } from 'react';
import { getDiscoverTopics } from '../data/mockData';
import { TrendingUp, FlaskConical, Palette, Gamepad2, Code, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const IconMap: Record<string, any> = {
  FlaskConical, Palette, Gamepad2, Code
};

export default function Discover() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('tab_all');
  const tabs = ['tab_all', 'tab_tech', 'tab_philosophy', 'tab_art', 'tab_entertainment', 'tab_ethics'];

  const discoverTopics = getDiscoverTopics(i18n.language);

  const filteredTopics = activeTab === 'tab_all' 
    ? discoverTopics 
    : discoverTopics.filter(t => t.category === activeTab || t.tag?.includes(activeTab));

  return (
    <div className="animate-in fade-in duration-500 pt-4">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t('discover_title')}</h1>
        <p className="text-on-surface-variant">{t('discover_subtitle')}</p>
      </header>
      
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
        {tabs.map((tab, i) => (
          <button 
            key={i} 
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-primary/10 text-primary' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'}`}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {filteredTopics.map((topic) => {
          if (topic.avatars) {
            // Featured topic
            return (
              <div key={topic.id} className="bg-surface-container-lowest p-6 rounded-2xl group hover:shadow-md transition-all duration-300 border border-transparent hover:border-surface-container-low cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-primary uppercase tracking-widest mb-2 block">{topic.tag}</span>
                    <h3 className="text-2xl font-bold mb-2">{topic.title}</h3>
                    <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                      <TrendingUp className="w-4 h-4" />
                      <span>{topic.stats}</span>
                    </div>
                  </div>
                  <div className="flex -space-x-3">
                    {topic.avatars.map((av, i) => (
                      <img key={i} src={av} alt="participant" className="w-10 h-10 rounded-full border-2 border-surface-container-lowest" />
                    ))}
                  </div>
                </div>
                <p className="text-on-surface-variant leading-relaxed mb-6">{topic.desc}</p>
                <button className="text-primary font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  {t('join_discussion')} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          }

          const Icon = IconMap[topic.icon as string];
          return (
            <div key={topic.id} className="bg-surface-container-lowest p-6 rounded-2xl group hover:shadow-md transition-all duration-300 border border-transparent hover:border-surface-container-low cursor-pointer">
              <div className="flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center shadow-sm">
                    {Icon && <Icon className={`w-6 h-6 ${topic.iconColor}`} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{topic.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-1">
                      <span className="font-medium">{topic.category}</span>
                      <span className="opacity-30">•</span>
                      <span>{topic.stats}</span>
                    </div>
                  </div>
                </div>
                <button className="bg-surface px-5 py-2 rounded-full text-sm font-bold border border-surface-container-low hover:bg-surface-container-low transition-colors">{t('join')}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
