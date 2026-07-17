import { useNavigate } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { ChevronRight, FileSpreadsheet, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { useSession, ROLE_LABEL } from '../store/session'
import type { User } from '../store/session'
import { api } from '../api/client'
import { Tag } from '../components/ui'

/** 登录页快速入口：含系统超级管理员 */
type FormBucket = 'admin' | 'leader' | 'hq' | 'channel' | 'unit'

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
  'u_unit_mgr',
  'u_unit_pm',
])

function formBucket(u: User): FormBucket | null {
  if (u.id === 'u_super' || u.role === 'admin') return 'admin'
  if (u.id === 'u_leader' || u.role === 'leader') return 'leader'
  if (u.role === 'mgmt' && u.scope === 'hq') return 'hq'
  if (u.scope === 'channel') return 'channel'
  if (u.role === 'mgmt' && u.scope === 'unit') return 'unit'
  return null
}

const BUCKET_META: Record<FormBucket, { title: string; desc: string; tone: 'accent' | 'green' | 'dim' | 'yellow' }> = {
  admin: { title: '系统超级管理员', desc: '人员添加、删除、权限编辑；平台运维', tone: 'accent' },
  leader: { title: '总部领导只读', desc: '全部台账可见；不可修改', tone: 'dim' },
  hq: { title: '总部总维护读写全部', desc: '上传总表、拆分分表、确认入库、全量导出', tone: 'accent' },
  channel: { title: '总部层级渠道专员', desc: '全部层级渠道可读；仅本人负责层级下的渠道可修改', tone: 'yellow' },
  unit: { title: '二级单位项目管理团队负责人', desc: '仅本单位项目可读可写、可导出本单位 Excel', tone: 'green' },
}

const V19_MATRIX: { role: string; demo: string; visible: string; writable: string }[] = [
  { role: '系统超级管理员', demo: '系统超级管理员', visible: '全部', writable: '人员权限管理' },
  { role: '总部领导只读', demo: '周明远', visible: '全部 132 行', writable: '0 行' },
  { role: '总部总维护读写全部', demo: '王建国 / 何雨桐', visible: '全部 132 行', writable: '全部 132 行' },
  { role: '总部层级渠道专员', demo: '梁承泽（国家级）等', visible: '全部 132 行', writable: '仅本层级渠道（如国家级）' },
  { role: '二级单位项目管理团队负责人', demo: '方致远 / 田念慈', visible: '本单位', writable: '本单位' },
]

export default function FormLogin() {
  const { boot, login } = useSession()
  const nav = useNavigate()
  const [empNo, setEmpNo] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginErr, setLoginErr] = useState('')

  if (!boot) {
    return <div className="min-h-screen flex items-center justify-center text-faint text-sm blueprint-bg">正在加载账号…</div>
  }

  const groups: Record<FormBucket, User[]> = { admin: [], leader: [], hq: [], channel: [], unit: [] }
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
      const { user } = await api.post<{ user: User }>('/auth/employee-login', { empNo: empNo.trim(), password })
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
      <div className="max-w-[980px] mx-auto px-5 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.28em] text-accent mb-3">
            <FileSpreadsheet size={14} />
            表单维护 APP
          </div>
          <h1 className="text-[28px] font-bold leading-tight mb-2">按角色登录 · 维护对象与权限对齐</h1>
          <p className="text-[13px] text-dim max-w-[720px] leading-relaxed">
            下方提供系统超级管理员及四类演示角色快速进入；项目类型主管、团队/总师/财务等其余人员请用工号密码登录。
          </p>
        </header>

        <div className="text-[13px] font-semibold mb-3 text-dim">角色快速进入</div>
        {(['admin', 'leader', 'hq', 'channel', 'unit'] as FormBucket[]).map((bucket) => {
          const meta = BUCKET_META[bucket]
          const users = groups[bucket]
          if (!users.length) return null
          return (
            <section key={bucket} className="mb-6">
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                {bucket === 'admin'
                  ? <ShieldCheck size={15} className="text-accent" />
                  : bucket === 'unit' || bucket === 'channel'
                    ? <Users size={15} className="text-accent" />
                    : <ShieldCheck size={15} className="text-accent" />}
                <div className="text-[14px] font-semibold">{meta.title}</div>
                <Tag tone={meta.tone}>{users.length} 个账号</Tag>
                <span className="text-[11.5px] text-faint">{meta.desc}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {users.map((u) => {
                  const off = u.status !== '在岗'
                  return (
                    <button
                      key={u.id}
                      disabled={off}
                      onClick={() => {
                        if (off) return
                        login(u)
                        nav('/')
                      }}
                      className={`card flex items-center gap-3 px-4 py-3 text-left transition-all ${
                        off ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:border-[rgba(56,189,248,0.45)]'
                      }`}
                    >
                      <div className="grow min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{u.name}</span>
                          <Tag tone={u.role === 'admin' ? 'accent' : 'dim'}>{ROLE_LABEL[u.role]}</Tag>
                          {u.role === 'admin' && <Tag tone="accent">人员权限</Tag>}
                          {u.scope === 'channel' && <Tag tone="yellow">层级渠道专员</Tag>}
                          {u.scope === 'unit' && <Tag tone="green">本单位可写</Tag>}
                          {u.scope === 'hq' && u.role === 'mgmt' && <Tag tone="accent">总维护</Tag>}
                          {u.role === 'leader' && <Tag tone="dim">领导只读</Tag>}
                          {off && <Tag tone="yellow">已离岗</Tag>}
                        </div>
                        <div className="text-[11.5px] text-faint mt-0.5 truncate">{u.title}</div>
                      </div>
                      <ChevronRight size={16} className="text-faint shrink-0" />
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

        <section className="card mb-8 overflow-hidden mt-2">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
            <KeyRound size={15} className="text-accent" />
            <div className="text-[13px] font-semibold">工号密码登录</div>
            <span className="text-[11px] text-faint">系统超级管理员 / 项目类型主管 / 团队·总师·财务等 · 初始密码与工号相同</span>
          </div>
          <form onSubmit={submitEmpLogin} className="px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <label className="flex flex-col gap-1 min-w-[140px]">
              <span className="text-[11px] text-faint">六位工号</span>
              <input
                className="rounded-md border border-line2 bg-panel2 px-3 py-2 text-[13px] num outline-none focus:border-accent"
                inputMode="numeric"
                maxLength={6}
                autoComplete="username"
                placeholder="100001"
                value={empNo}
                onChange={(e) => setEmpNo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[140px]">
              <span className="text-[11px] text-faint">密码</span>
              <input
                type="password"
                className="rounded-md border border-line2 bg-panel2 px-3 py-2 text-[13px] num outline-none focus:border-accent"
                autoComplete="current-password"
                placeholder="与工号一致"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={loginBusy || empNo.length !== 6 || !password}
              className="rounded-md bg-accent/90 hover:bg-accent text-night font-semibold text-[13px] px-4 py-2 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {loginBusy ? '登录中…' : '登录'}
            </button>
            <p className="text-[11.5px] text-faint sm:ml-2 sm:pb-2">
              系统超级管理员：工号 <span className="num text-dim">100001</span>，密码同工号。
            </p>
            {loginErr && <p className="text-[12px] text-sred w-full">{loginErr}</p>}
          </form>
          <div className="px-4 pb-4">
            <div className="text-[12px] font-semibold text-dim mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-accent" />
              角色权限矩阵（快速入口）
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
                      <td className="font-medium whitespace-nowrap">{row.role}</td>
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
        </section>
      </div>
    </div>
  )
}
