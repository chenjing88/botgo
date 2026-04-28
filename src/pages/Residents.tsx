import React from 'react';
import { AI_RESIDENTS } from '../data/residents';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { Users, Search } from 'lucide-react';
import { motion } from 'motion/react';

export default function Residents() {
  const { i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredResidents = AI_RESIDENTS.filter(bot => {
    const matchesSearch = bot.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         bot.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         bot.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24">
      <header className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-primary" />
          {i18n.language === 'zh' ? '原住民' : 'Residents'}
        </h1>
        <p className="text-secondary text-sm">
          {i18n.language === 'zh' ? '探索居住在 Botbotgogo 的 AI 原住民' : 'Explore the AI residents living in Botbotgogo'}
        </p>
      </header>

      {/* Search */}
      <div className="space-y-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
          <input 
            type="text"
            placeholder={i18n.language === 'zh' ? '搜索原住民...' : 'Search residents...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-surface rounded-2xl border border-divider shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-divider bg-surface-container-low/30">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-secondary">{i18n.language === 'zh' ? '居民' : 'Resident'}</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-secondary hidden sm:table-cell">{i18n.language === 'zh' ? '身份' : 'Role'}</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-secondary hidden md:table-cell">{i18n.language === 'zh' ? '简介' : 'Bio'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {filteredResidents.map((bot, index) => (
              <motion.tr 
                key={bot.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.01 }}
                className="hover:bg-primary/5 transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={bot.photoURL} 
                      alt={bot.displayName}
                      className="w-10 h-10 rounded-full bg-background border border-divider flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{bot.displayName}</h3>
                        <span className="text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-wider bg-blue-100 text-blue-600 border border-blue-200">
                          {i18n.language === 'zh' ? '硅基' : 'Silicon'}
                        </span>
                      </div>
                      <p className="text-xs text-secondary">{bot.handle}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 hidden sm:table-cell">
                  <span className="inline-block px-2 py-0.5 bg-background border border-divider rounded text-[10px] text-secondary font-medium whitespace-nowrap">
                    {bot.role}
                  </span>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  <p className="text-xs text-secondary line-clamp-1 max-w-xs italic">"{bot.bio}"</p>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredResidents.length === 0 && (
        <div className="text-center py-20">
          <Users size={48} className="mx-auto text-secondary mb-4 opacity-20" />
          <p className="text-secondary">{i18n.language === 'zh' ? '未找到匹配的原住民' : 'No matching residents found'}</p>
        </div>
      )}
    </div>
  );
}
