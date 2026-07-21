import { useNavigate } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { useSession, ROLE_LABEL } from '../store/session'
import type { User } from '../store/session'
import { api } from '../api/client'
import { Tag } from '../components/ui'

/** 登录页快速入口：含系统超级管理员（默认收起，入口保留） */
type FormBucket = 'admin' | 'leader' | 'hq' | 'channel'

const QUICK_LOGIN_IDS = new Set([
  'u_super',
  'u_leader',
  'u_hq',
  'u_hq_staff',
  'u_ch_miit',
  'u_ch_most',
  'u_ch_ndrc',
  'u_ch_shkc',
  'u_ch_zgsf',
])

function formBucket(u: User): FormBucket | null {
  if (u.id === 'u_super' || u.role === 'admin') return 'admin'
  if (u.id === 'u_leader' || u.role === 'leader') return 'leader'
  if (u.role === 'mgmt' && u.scope === 'hq') return 'hq'
  if (u.scope === 'channel') return 'channel'
  return null
}

const BUCKET_META: Record<FormBucket, { title: string; desc: string; tone: 'accent' | 'green' | 'dim' | 'yellow' }> = {
  admin: { title: '系统超级管理员', desc: '人员添加、删除、权限编辑；平台运维', tone: 'accent' },
  leader: { title: '总部领导只读', desc: '全部台账可见；不可修改', tone: 'dim' },
  hq: { title: '总部总维护读写全部', desc: '上传总表、拆分分表、确认入库、全量导出', tone: 'accent' },
  channel: { title: '总部层级渠道专员', desc: '全部层级渠道可读；仅本人负责层级下的渠道可修改', tone: 'yellow' },
}

const V19_MATRIX: { role: string; demo: string; visible: string; writable: string }[] = [
  { role: '系统超级管理员', demo: '系统超级管理员', visible: '全部', writable: '人员权限管理' },
  { role: '总部领导只读', demo: '周明远', visible: '全部 132 行', writable: '0 行' },
  { role: '总部总维护读写全部', demo: '王建国 / 何雨桐', visible: '全部 132 行', writable: '全部 132 行' },
  { role: '总部层级渠道专员', demo: '梁承泽（国家级）等', visible: '全部 132 行', writable: '仅本层级渠道（如国家级）' },
]

export default function FormLogin() {
  const { boot, login } = useSession()
  const nav = useNavigate()
  const [empNo, setEmpNo] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginErr, setLoginErr] = useState('')
  const [demoOpen, setDemoOpen] = useState(false)

  if (!boot) {
    return <div className="min-h-screen flex items-center justify-center text-faint text-sm blueprint-bg">正在加载账号…</div>
  }

  const groups: Record<FormBucket, User[]> = { admin: [], leader: [], hq: [], channel: [] }
  for (const u of boot.users) {
    if (!QUICK_LOGIN_IDS.has(u.id)) continue
    const bucket = formBucket(u)
    if (bucket) groups[bucket].push(u)
  }

  const submitEmpLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoginErr('')
    setLoginBusy(true)
    try {
      const { user } = await api.post<{ user: User; mustChangePassword?: boolean }>(
        '/auth/employee-login',
        { empNo: empNo.trim(), password },
      )
      login(user)
      nav('/')
    } catch (err) {
      setLoginErr((err as Error).message || '登录失败')
    } finally {
      setLoginBusy(false)
    }
  }

  return (
    <div className="min-h-screen blueprint-bg text-ink">
      <div className="max-w-[520px] mx-auto px-5 py-12">
        <header className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.28em] text-accent mb-3">
            <FileSpreadsheet size={14} />
            表单维护 APP
          </div>
          <h1 className="text-[26px] font-bold leading-tight mb-2">账户密码登录</h1>
          <p className="text-[13px] text-dim leading-relaxed">
            使用六位工号与密码登录。初始密码与工号相同，首次登录须修改密码。
          </p>
        </header>

        <section className="card mb-5 overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
            <KeyRound size={15} className="text-accent" />
            <div className="text-[13px] font-semibold">登录</div>
          </div>
          <form onSubmit={submitEmpLogin} className="px-4 py-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-faint">账户（六位工号）</span>
              <input
                className="rounded-md border border-line2 bg-panel2 px-3 py-2.5 text-[13px] num outline-none focus:border-accent"
                inputMode="numeric"
                maxLength={6}
                autoComplete="username"
                placeholder="100001"
                value={empNo}
                onChange={(e) => setEmpNo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-faint">密码</span>
              <input
                type="password"
                className="rounded-md border border-line2 bg-panel2 px-3 py-2.5 text-[13px] num outline-none focus:border-accent"
                autoComplete="current-password"
                placeholder="初始密码与工号相同"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={loginBusy || empNo.length !== 6 || !password}
              className="rounded-md bg-accent/90 hover:bg-accent text-night font-semibold text-[13px] px-4 py-2.5 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {loginBusy ? '登录中…' : '登录'}
            </button>
            <p className="text-[11.5px] text-faint">
              系统超级管理员：工号 <span className="num text-dim">100001</span>，初始密码同工号。
            </p>
            {loginErr && <p className="text-[12px] text-sred">{loginErr}</p>}
          </form>
        </section>

        <section className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-[rgba(56,189,248,0.04)] cursor-pointer transition-colors"
            aria-expanded={demoOpen}
          >
            <Users size={15} className="text-accent shrink-0" />
            <div className="grow min-w-0">
              <div className="text-[13px] font-semibold">角色演示入口</div>
              <div className="text-[11px] text-faint mt-0.5">演示用快速进入，功能保留 · 默认收起</div>
            </div>
            {demoOpen ? <ChevronDown size={16} className="text-faint shrink-0" /> : <ChevronRight size={16} className="text-faint shrink-0" />}
          </button>

          {demoOpen && (
            <div className="px-4 pb-4 border-t border-line pt-3">
              <div className="text-[12px] text-dim mb-3 leading-relaxed">
                点击下方账号可跳过密码直接进入（仅演示）。正式使用请用工号密码登录。
              </div>
              {(['admin', 'leader', 'hq', 'channel'] as FormBucket[]).map((bucket) => {
                const meta = BUCKET_META[bucket]
                const users = groups[bucket]
                if (!users.length) return null
                return (
                  <div key={bucket} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <ShieldCheck size={14} className="text-accent" />
                      <div className="text-[13px] font-semibold">{meta.title}</div>
                      <Tag tone={meta.tone}>{users.length} 个账号</Tag>
                      <span className="text-[11px] text-faint">{meta.desc}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {users.map((u) => {
                        const off = u.status !== '在岗'
                        return (
                          <button
                            key={u.id}
                            type="button"
                            disabled={off}
                            onClick={() => {
                              if (off) return
                              login(u, { skipPasswordGate: true })
                              nav('/')
                            }}
                            className={`rounded-md border border-line bg-panel2 flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                              off ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:border-[rgba(56,189,248,0.45)]'
                            }`}
                          >
                            <div className="grow min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-[13px]">{u.name}</span>
                                <Tag tone={u.role === 'admin' ? 'accent' : 'dim'}>{ROLE_LABEL[u.role]}</Tag>
                                {off && <Tag tone="yellow">已离岗</Tag>}
                              </div>
                              <div className="text-[11px] text-faint mt-0.5 truncate">{u.title}</div>
                            </div>
                            <ChevronRight size={14} className="text-faint shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <div className="mt-2">
                <div className="text-[12px] font-semibold text-dim mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-accent" />
                  角色权限矩阵
                </div>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="dtable">
                    <thead>
                      <tr>
                        <th>角色</th>
                        <th>演示账号</th>
                        <th>可见</th>
                        <th>可写</th>
                      </tr>
                    </thead>
                    <tbody>
                      {V19_MATRIX.map((row) => (
                        <tr key={row.role}>
                          <td className="font-medium whitespace-nowrap text-[12px]">{row.role}</td>
                          <td className="text-[12px]">{row.demo}</td>
                          <td className="text-[12px] text-dim">{row.visible}</td>
                          <td className="text-[12px]">
                            {row.writable === '0 行'
                              ? <Tag tone="dim">{row.writable}</Tag>
                              : <Tag tone="green">{row.writable}</Tag>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
