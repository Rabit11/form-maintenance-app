import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { api } from '../api/client'
import { useSession } from '../store/session'
import type { User } from '../store/session'

/** 初次登录强制改密 */
export default function ChangePasswordGate() {
  const { user, login, logout } = useSession()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!user) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const r = await api.post<{ ok: boolean; user: User }>('/auth/change-password', {
        oldPassword,
        newPassword,
        confirmPassword,
      })
      login(r.user)
    } catch (e2) {
      setErr((e2 as Error).message || '修改失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen blueprint-bg text-ink flex items-center justify-center px-5">
      <div className="w-full max-w-[440px] card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <KeyRound size={16} className="text-accent" />
            首次登录 · 修改密码
          </div>
          <p className="text-[12px] text-dim mt-1.5 leading-relaxed">
            账号 <span className="text-ink font-medium">{user.name}</span>
            {user.emp_no ? <>（工号 <span className="num">{user.emp_no}</span>）</> : null}
            仍使用初始密码，请设置新密码后再进入系统。
          </p>
        </div>
        <form onSubmit={submit} className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-faint">当前密码（初始为工号）</span>
            <input
              type="password"
              className="rounded-md border border-line2 bg-panel2 px-3 py-2.5 text-[13px] outline-none focus:border-accent"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-faint">新密码（至少 6 位，不能与工号相同）</span>
            <input
              type="password"
              className="rounded-md border border-line2 bg-panel2 px-3 py-2.5 text-[13px] outline-none focus:border-accent"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-faint">确认新密码</span>
            <input
              type="password"
              className="rounded-md border border-line2 bg-panel2 px-3 py-2.5 text-[13px] outline-none focus:border-accent"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          {err && <p className="text-[12px] text-sred">{err}</p>}
          <button
            type="submit"
            disabled={busy || !oldPassword || !newPassword || !confirmPassword}
            className="rounded-md bg-accent/90 hover:bg-accent text-night font-semibold text-[13px] px-4 py-2.5 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {busy ? '提交中…' : '确认修改并进入'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-[12px] text-faint hover:text-dim cursor-pointer py-1"
          >
            退出重新登录
          </button>
        </form>
      </div>
    </div>
  )
}
