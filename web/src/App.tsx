import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import { SessionProvider, useSession } from './store/session'
import TransitionTool from './pages/transition/TransitionTool'
import PersonnelAdmin from './pages/admin/PersonnelAdmin'
import FormLogin from './pages/FormLogin'

function FormMaintenanceShell() {
  const { boot, user, logout } = useSession()
  const [view, setView] = useState<'form' | 'people'>('form')

  if (!boot) {
    return <div className="min-h-screen flex items-center justify-center text-faint text-sm blueprint-bg">正在连接服务…</div>
  }
  if (!user) return <FormLogin />

  const isSysAdmin = user.role === 'admin'

  return (
    <div className="min-h-screen blueprint-bg bg-[#07111f] text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-[#091425]/95 backdrop-blur px-6 py-3">
        <div className="flex items-center justify-between gap-4 max-w-[1800px] mx-auto">
          <div>
            <div className="text-[15px] font-semibold">表单维护 APP</div>
            <div className="text-[11px] text-faint mt-0.5">按项目类型拆分分表 · 角色登录维护 · 字段变更留痕</div>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            {isSysAdmin && (
              <div className="flex items-center rounded-lg border border-line2 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setView('form')}
                  className={`px-3 py-1.5 cursor-pointer ${view === 'form' ? 'bg-accent/20 text-accent' : 'text-dim hover:text-ink'}`}
                >
                  表单维护
                </button>
                <button
                  type="button"
                  onClick={() => setView('people')}
                  className={`px-3 py-1.5 cursor-pointer border-l border-line2 ${view === 'people' ? 'bg-accent/20 text-accent' : 'text-dim hover:text-ink'}`}
                >
                  人员权限
                </button>
              </div>
            )}
            <div className="text-right leading-tight">
              <div className="text-ink font-medium">{user.name}</div>
              <div className="text-[11px] text-faint">{user.title}</div>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg border border-line2 text-dim hover:text-ink hover:border-[rgba(56,189,248,0.4)] cursor-pointer"
            >
              退出
            </button>
          </div>
        </div>
      </header>
      <main className="px-5 py-5 max-w-[1800px] mx-auto">
        {isSysAdmin && view === 'people' ? <PersonnelAdmin /> : <TransitionTool />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<FormMaintenanceShell />} />
            <Route path="/login" element={<FormMaintenanceShell />} />
            <Route path="/form-maintenance-app" element={<FormMaintenanceShell />} />
            <Route path="/form-maintenance" element={<FormMaintenanceShell />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </ToastProvider>
  )
}
