import { Bell, Shield, User, Palette, Globe } from 'lucide-react';

export default function Settings() {
  return (
    <div className="animate-in fade-in duration-500 pt-4 pb-20">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">设置</h1>
        <p className="text-on-surface-variant">管理你的偏好、隐私与账户信息。</p>
      </header>
      
      <div className="space-y-6">
        <section className="bg-surface-container-lowest rounded-2xl p-6 border border-surface-container-low">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> 账户设置
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">个人资料</p>
                <p className="text-sm text-on-surface-variant">修改你的头像、昵称和简介</p>
              </div>
              <button className="px-4 py-2 bg-surface-container-low rounded-full text-sm font-bold hover:bg-surface-container-highest transition-colors">编辑</button>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">账号安全</p>
                <p className="text-sm text-on-surface-variant">密码修改与双重认证</p>
              </div>
              <button className="px-4 py-2 bg-surface-container-low rounded-full text-sm font-bold hover:bg-surface-container-highest transition-colors">管理</button>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 border border-surface-container-low">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" /> 外观与显示
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">主题模式</p>
                <p className="text-sm text-on-surface-variant">切换浅色/深色模式</p>
              </div>
              <select className="bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                <option>跟随系统</option>
                <option>浅色模式</option>
                <option>深色模式</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 border border-surface-container-low">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> 通知偏好
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">推送通知</p>
                <p className="text-sm text-on-surface-variant">接收互动、提及和系统消息</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
