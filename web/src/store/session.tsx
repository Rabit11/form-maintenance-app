import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setApiUser } from '../api/client'

export interface User {
  id: string
  name: string
  role: 'team' | 'chief' | 'mgmt' | 'finance' | 'admin' | 'leader'
  scope: string
  unit_id: number
  title: string
  status: string
  emp_no?: string | null
  must_change_password?: number
}
export interface Unit { id: number; name: string; short: string; kind: string }
export interface Channel {
  id: number; key: string; name: string; level: string; org: string; dept: string
  flow: string[]; declare: string[]; filing: string[]; chain: string[]
  declare_mode: string; assess: string[]; enabled: number
}
export interface Bootstrap { today: string; units: Unit[]; channels: Channel[]; users: User[] }

interface Session {
  boot: Bootstrap | null
  user: User | null
  /** skipPasswordGate：角色演示快速进入时跳过强制改密 */
  login: (u: User, opts?: { skipPasswordGate?: boolean }) => void
  logout: () => void
  skipPasswordGate: boolean
  unitOf: (id: number) => Unit | undefined
  channelOf: (id: number) => Channel | undefined
}

const Ctx = createContext<Session>(null as unknown as Session)

export const ROLE_HOME: Record<User['role'], string> = {
  leader: '/',
  mgmt: '/',
  team: '/',
  chief: '/',
  finance: '/',
  admin: '/',
}

export const ROLE_LABEL: Record<User['role'], string> = {
  leader: '领导 / 决策查看',
  mgmt: '管理团队',
  team: '项目团队',
  chief: '责任总师',
  finance: '财务团队',
  admin: '系统超级管理员',
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [skipPasswordGate, setSkipPasswordGate] = useState(false)

  useEffect(() => {
    api.get<Bootstrap>('/bootstrap').then((b) => {
      setBoot(b)
      const saved = localStorage.getItem('srpm.user')
      if (saved) {
        const u = b.users.find((x) => x.id === saved)
        if (u) {
          setApiUser(u.id)
          setUser(u)
          setSkipPasswordGate(localStorage.getItem('srpm.skipPwdGate') === '1')
        } else {
          localStorage.removeItem('srpm.user')
          localStorage.removeItem('srpm.skipPwdGate')
          setApiUser('')
        }
      }
    })
  }, [])

  const value = useMemo<Session>(() => ({
    boot,
    user,
    skipPasswordGate,
    login: (u, opts) => {
      localStorage.setItem('srpm.user', u.id)
      const skip = Boolean(opts?.skipPasswordGate)
      if (skip) localStorage.setItem('srpm.skipPwdGate', '1')
      else localStorage.removeItem('srpm.skipPwdGate')
      setSkipPasswordGate(skip)
      setApiUser(u.id)
      setUser(u)
    },
    logout: () => {
      localStorage.removeItem('srpm.user')
      localStorage.removeItem('srpm.skipPwdGate')
      setSkipPasswordGate(false)
      setApiUser('')
      setUser(null)
    },
    unitOf: (id) => boot?.units.find((x) => x.id === id),
    channelOf: (id) => boot?.channels.find((x) => x.id === id),
  }), [boot, user, skipPasswordGate])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
