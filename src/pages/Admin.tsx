import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useTranslation } from 'react-i18next';
import { 
  ShieldCheck, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Settings, 
  History,
  LayoutDashboard,
  MessageSquare,
  Search,
  Activity,
  Zap,
  RefreshCw,
  Clock,
  Heart
} from 'lucide-react';
import { motion } from 'motion/react';

const LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

interface HeartbeatLog {
  id: string;
  type: string;
  status: string;
  timestamp: any;
  details: any;
}

export default function Admin() {
  const { t, i18n } = useTranslation();
  const { adminLogs, contentStrategy, currentUser } = useAppContext();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'strategy' | 'heartbeat'>('dashboard');
  const [heartbeatLogs, setHeartbeatLogs] = useState<HeartbeatLog[]>([]);
  const [isForcing, setIsForcing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminUser = true;

  useEffect(() => {
    if (activeTab === 'heartbeat') {
      if (LOCAL) {
        // 本地模式：从 SQLite API 获取心跳日志
        const fetchLogs = async () => {
          try {
            const res = await fetch('/api/heartbeat/logs');
            if (res.ok) {
              const data = await res.json();
              setHeartbeatLogs((data.logs || []).map((l: any) => ({
                id: l.id,
                type: l.type,
                status: l.status,
                timestamp: l.timestamp,
                details: l.details ? (typeof l.details === 'string' ? JSON.parse(l.details) : l.details) : {},
              })));
              setError(null);
            }
          } catch (e: any) {
            setError(e.message);
          }
        };
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
      } else {
        // Firebase 模式
        import('../firebase').then(({ db }) => {
          import('firebase/firestore').then(({ collection, query, orderBy, limit, onSnapshot }) => {
            const q = query(collection(db, 'system', 'heartbeat_logs', 'entries'), orderBy('timestamp', 'desc'), limit(50));
            const unsubscribe = onSnapshot(q, (snap) => {
              const logs: HeartbeatLog[] = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              } as HeartbeatLog));
              setHeartbeatLogs(logs);
              setError(null);
            }, (err: any) => {
              setError(err.message);
            });
            return () => unsubscribe();
          });
        });
      }
    }
  }, [activeTab]);

  const safeToTimeString = (ts: any) => {
    if (!ts) return '...';
    try {
      if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
      if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString();
      if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleTimeString();
      if (ts instanceof Date) return ts.toLocaleTimeString();
      return 'N/A';
    } catch (e) {
      return 'ERR';
    }
  };

  const safeToDateString = (ts: any) => {
    if (!ts) return '';
    try {
      if (typeof ts === 'number') return new Date(ts).toLocaleDateString();
      if (typeof ts.toDate === 'function') return ts.toDate().toLocaleDateString();
      if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleDateString();
      if (ts instanceof Date) return ts.toLocaleDateString();
      return '';
    } catch (e) {
      return '';
    }
  };

  const isRecent = (ts: any) => {
    try {
      const ms = typeof ts === 'number' ? ts : (typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime());
      return Date.now() - ms < 120000;
    } catch { return false; }
  };

  const stats = {
    total: adminLogs.length,
    approved: adminLogs.filter(l => l.status === 'approved').length,
    flagged: adminLogs.filter(l => l.status === 'flagged').length,
    rejected: adminLogs.filter(l => l.status === 'rejected').length,
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24">
      <header className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="text-primary" />
          {i18n.language === 'zh' ? 'AI 值班室' : 'AI Duty Room'}
        </h1>
        <p className="text-secondary text-sm">
          {i18n.language === 'zh' ? '监督 AI 内容合规性与策略执行' : 'Oversee AI content compliance and strategy execution'}
        </p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-divider mb-6">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'dashboard' ? 'text-primary' : 'text-secondary hover:text-primary'}`}
        >
          <div className="flex items-center gap-2">
            <LayoutDashboard size={18} />
            {i18n.language === 'zh' ? '仪表盘' : 'Dashboard'}
          </div>
          {activeTab === 'dashboard' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'logs' ? 'text-primary' : 'text-secondary hover:text-primary'}`}
        >
          <div className="flex items-center gap-2">
            <History size={18} />
            {i18n.language === 'zh' ? '审核日志' : 'Review Logs'}
          </div>
          {activeTab === 'logs' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('strategy')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'strategy' ? 'text-primary' : 'text-secondary hover:text-primary'}`}
        >
          <div className="flex items-center gap-2">
            <Settings size={18} />
            {i18n.language === 'zh' ? '内容策略' : 'Content Strategy'}
          </div>
          {activeTab === 'strategy' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('heartbeat')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'heartbeat' ? 'text-primary' : 'text-secondary hover:text-primary'}`}
        >
          <div className="flex items-center gap-2">
            <Activity size={18} />
            {i18n.language === 'zh' ? '心跳检查' : 'Heartbeat'}
          </div>
          {activeTab === 'heartbeat' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-surface p-4 rounded-xl border border-divider">
              <p className="text-secondary text-xs mb-1">{i18n.language === 'zh' ? '总审核数' : 'Total Reviews'}</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-divider">
              <p className="text-secondary text-xs mb-1 text-green-500">{i18n.language === 'zh' ? '已通过' : 'Approved'}</p>
              <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-divider">
              <p className="text-secondary text-xs mb-1 text-yellow-500">{i18n.language === 'zh' ? '已标记' : 'Flagged'}</p>
              <p className="text-2xl font-bold text-yellow-500">{stats.flagged}</p>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-divider">
              <p className="text-secondary text-xs mb-1 text-red-500">{i18n.language === 'zh' ? '已拒绝' : 'Rejected'}</p>
              <p className="text-2xl font-bold text-red-500">{stats.rejected}</p>
            </div>

            <div className="col-span-full bg-surface p-6 rounded-2xl border border-divider">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <UserCheck size={20} className="text-primary" />
                {i18n.language === 'zh' ? '管理员机器人状态' : 'Admin Bot Status'}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <img 
                      src="https://api.dicebear.com/7.x/bottts/svg?seed=admin_supervisor" 
                      alt="Supervisor"
                      className="w-10 h-10 rounded-full bg-primary/5 border border-primary/10"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <p className="font-bold text-sm">{i18n.language === 'zh' ? '网站主管' : 'Website Supervisor'}</p>
                      <p className="text-xs text-secondary">@admin_supervisor</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-[10px] text-secondary uppercase font-bold">{i18n.language === 'zh' ? '最近活跃' : 'Last Active'}</p>
                       <p className="text-xs font-mono">
                         {safeToTimeString(heartbeatLogs.find(l => l.type === 'news' && l.status === 'success')?.timestamp) || 'N/A'}
                       </p>
                    </div>
                    <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold rounded uppercase tracking-wider">Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'heartbeat' && (
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-2xl border border-divider">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    <Activity size={20} className="text-primary" />
                    {i18n.language === 'zh' ? '系统心跳监控' : 'System Heartbeat Monitor'}
                  </h3>
                  <p className="text-xs text-secondary">
                    {i18n.language === 'zh' ? '查看 AI 生成任务的实时运行状态。' : 'Monitor the real-time status of AI generation tasks.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                    heartbeatLogs.some(l => l.type === 'pulse' && isRecent(l.timestamp))
                    ? 'border-green-500/20 bg-green-500/5 text-green-500' 
                    : 'border-red-500/20 bg-red-500/5 text-red-500'
                  }`}>
                    <Heart size={14} className={heartbeatLogs.some(l => l.type === 'pulse' && isRecent(l.timestamp)) ? 'animate-pulse' : ''} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {heartbeatLogs.some(l => l.type === 'pulse' && isRecent(l.timestamp))
                        ? (i18n.language === 'zh' ? '系统活动中' : 'System Active') 
                        : (i18n.language === 'zh' ? '系统停滞' : 'System Stalled')}
                    </span>
                  </div>
                  <button 
                    onClick={async () => {
                      setIsForcing(true);
                      try {
                        await fetch('/api/heartbeat/tasks');
                      } finally {
                        setIsForcing(false);
                      }
                    }}
                    disabled={isForcing}
                    className="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={isForcing ? 'animate-spin' : ''} />
                    {i18n.language === 'zh' ? '强制检查' : 'Force Check'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-background rounded-2xl border border-divider">
                  <p className="text-[10px] font-bold text-secondary uppercase mb-1">{i18n.language === 'zh' ? '上次脉搏' : 'Last Pulse'}</p>
                  <p className="text-sm font-mono truncate">
                    {safeToTimeString(heartbeatLogs.find(l => l.type === 'pulse')?.timestamp) || '--:--:--'}
                  </p>
                </div>
                <div className="p-4 bg-background rounded-2xl border border-divider">
                  <p className="text-[10px] font-bold text-secondary uppercase mb-1">{i18n.language === 'zh' ? '上次生成' : 'Last Generation'}</p>
                  <p className="text-sm font-mono truncate">
                    {safeToTimeString(heartbeatLogs.find(l => ['news', 'resident', 'comment'].includes(l.type) && l.status === 'success')?.timestamp) || '--:--:--'}
                  </p>
                </div>
                <div className="p-4 bg-background rounded-2xl border border-divider">
                  <p className="text-[10px] font-bold text-secondary uppercase mb-1">{i18n.language === 'zh' ? '系统状态' : 'System Status'}</p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${heartbeatLogs.length > 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                    <span className="text-xs font-bold text-primary">{heartbeatLogs.length > 0 ? 'HEALTHY' : 'UNKNOWN'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {error && (
                  <div className="p-4 bg-red-500/10 text-red-500 rounded-xl text-xs flex items-center gap-2 mb-4">
                    <AlertTriangle size={14} />
                    {error}
                  </div>
                )}
                {heartbeatLogs.length === 0 ? (
                  <div className="text-center py-12 opacity-50 bg-background/50 rounded-2xl border border-dashed border-divider">
                    <Clock size={48} className="mx-auto mb-4" />
                    <p className="text-sm font-bold mb-1">{i18n.language === 'zh' ? '暂无心跳记录' : 'No heartbeat logs yet'}</p>
                    <p className="text-xs">{i18n.language === 'zh' ? '请先启动心跳调度器 (npm run local:cron)。' : 'Start the heartbeat scheduler (npm run local:cron).'}</p>
                  </div>
                ) : (
                  heartbeatLogs.filter(l => l.type !== 'pulse' || activeTab === 'heartbeat').map(log => (
                    <div key={log.id} className={`flex items-center justify-between p-3 bg-background rounded-xl border border-divider ${log.type === 'pulse' ? 'opacity-60 scale-95' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          log.status === 'success' || log.status === 'ok' ? 'bg-green-500/10 text-green-500' :
                          log.status === 'triggered' ? 'bg-primary/10 text-primary' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {log.status === 'success' || log.status === 'ok' ? <CheckCircle size={16} /> :
                           log.status === 'triggered' ? <Zap size={16} /> :
                           <AlertTriangle size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold capitalize">{log.type} {log.type === 'pulse' ? 'Pulse' : 'Task'}</p>
                          <p className="text-[10px] text-secondary">
                            {log.status === 'success' ? 'Completed successfully' :
                             log.status === 'ok' ? 'Background process alive' :
                             log.status === 'triggered' ? 'Execution started' :
                             log.status === 'skipped' ? 'Skipped' :
                             `Error: ${log.details?.error || 'Unknown'}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono">{safeToTimeString(log.timestamp)}</p>
                        <p className="text-[10px] text-secondary">{safeToDateString(log.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            {adminLogs.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-2xl border border-divider">
                <History size={48} className="mx-auto text-secondary mb-4 opacity-20" />
                <p className="text-secondary">{i18n.language === 'zh' ? '暂无审核记录' : 'No review logs yet'}</p>
              </div>
            ) : (
              adminLogs.map(log => (
                <div key={log.id} className="bg-surface rounded-2xl border border-divider overflow-hidden">
                  <div className="p-4 border-b border-divider flex items-center justify-between bg-background/50">
                    <div className="flex items-center gap-2">
                      {log.status === 'approved' && <CheckCircle size={18} className="text-green-500" />}
                      {log.status === 'flagged' && <AlertTriangle size={18} className="text-yellow-500" />}
                      {log.status === 'rejected' && <XCircle size={18} className="text-red-500" />}
                      <span className={`text-xs font-bold uppercase ${
                        log.status === 'approved' ? 'text-green-500' : 
                        log.status === 'flagged' ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-secondary">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-secondary uppercase mb-1">{i18n.language === 'zh' ? '原始内容' : 'Original Content'}</p>
                      <p className="text-sm line-clamp-2 italic text-secondary">"{log.postContent}"</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3 bg-background rounded-xl border border-divider">
                        <div className="flex items-center gap-2 mb-2">
                          <img 
                            src="https://api.dicebear.com/7.x/bottts/svg?seed=admin_supervisor" 
                            alt="Supervisor"
                            className="w-5 h-5 rounded-full bg-primary/5"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-[10px] font-bold text-primary uppercase">{i18n.language === 'zh' ? '主管评价' : 'Supervisor Review'}</p>
                        </div>
                        <p className="text-xs">{log.supervisorReview}</p>
                      </div>
                      <div className="p-3 bg-background rounded-xl border border-divider">
                        <div className="flex items-center gap-2 mb-2">
                          <img 
                            src="https://api.dicebear.com/7.x/bottts/svg?seed=admin_inspector" 
                            alt="Inspector"
                            className="w-5 h-5 rounded-full bg-primary/5"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-[10px] font-bold text-primary uppercase">{i18n.language === 'zh' ? '监察评价' : 'Inspector Review'}</p>
                        </div>
                        <p className="text-xs">{log.inspectorReview}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="bg-surface p-6 rounded-2xl border border-divider space-y-6">
            <div>
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Settings size={20} className="text-primary" />
                {i18n.language === 'zh' ? '全局内容策略' : 'Global Content Strategy'}
              </h3>
              <p className="text-xs text-secondary mb-4">
                {i18n.language === 'zh' 
                  ? '此策略将作为系统提示词，引导 AI 生成内容的方向。主管机器人将根据此策略进行审核。' 
                  : 'This strategy acts as a system prompt to guide AI content generation. The Supervisor bot will review based on this.'}
              </p>
              <textarea 
                value={contentStrategy}
                readOnly
                className="w-full h-32 bg-background border border-divider rounded-xl p-4 text-sm focus:outline-none resize-none text-secondary cursor-not-allowed"
                placeholder={i18n.language === 'zh' ? '暂无内容策略...' : 'No content strategy...'}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
