import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { X } from 'lucide-react'
import { FOUR_HEX, FOUR_LABEL } from '../../lib/status'
import type { Four } from '../../lib/status'
import { EmptyArt } from '../art'

/* ---------- 卡片 ---------- */
export function Card({ title, icon, extra, className = '', pad = true, children }: {
  title?: ReactNode; icon?: ReactNode; extra?: ReactNode; className?: string; pad?: boolean; children: ReactNode
}) {
  return (
    <section className={`card ${className}`}>
      {title != null && (
        <header className="card-hd">
          <h3 className="card-title">{title}{icon && <span className="text-dim">{icon}</span>}</h3>
          {extra}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

/* ---------- 数字滚动 ---------- */
export function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (started.current && val === target) return
    started.current = true
    const from = 0
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setVal(from + (target - from) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])
  return val
}

export function KPI({ label, value, unit, sub, tone = 'default', decimals = 0 }: {
  label: string; value: number; unit?: string; sub?: ReactNode; decimals?: number
  tone?: 'default' | 'accent' | 'red' | 'yellow' | 'green'
}) {
  const v = useCountUp(value)
  const toneColor = { default: 'text-ink', accent: 'text-accent', red: 'text-sred', yellow: 'text-syellow', green: 'text-sgreen' }[tone]
  return (
    <div className="card px-4 py-3 flex flex-col gap-1 min-w-0">
      <div className="text-[11.5px] tracking-wider text-dim">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={`num text-[26px] leading-8 font-semibold ${toneColor}`}>
          {v.toLocaleString('zh-CN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
        </span>
        {unit && <span className="text-[11px] text-faint">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-faint truncate">{sub}</div>}
    </div>
  )
}

/* ---------- 四色状态 ---------- */
export function StatusDot({ color, pulse }: { color: Four; pulse?: boolean }) {
  return (
    <span className="relative inline-flex w-2 h-2 shrink-0">
      {pulse && color === 'red' && (
        <span className="absolute inset-0 rounded-full opacity-70" style={{ background: FOUR_HEX.red, animation: 'pulseRing 1.8s ease-out infinite' }} />
      )}
      <span className="relative w-2 h-2 rounded-full" style={{ background: FOUR_HEX[color] }} />
    </span>
  )
}

export function FourBadge({ color, label }: { color: Four; label?: string }) {
  return (
    <span className="chip" style={{ borderColor: `${FOUR_HEX[color]}44`, color: FOUR_HEX[color], background: `${FOUR_HEX[color]}12` }}>
      <StatusDot color={color} pulse={color === 'red'} />
      {label ?? FOUR_LABEL[color]}
    </span>
  )
}

export function Tag({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'accent' | 'green' | 'yellow' | 'red' | 'violet' }) {
  const map = {
    dim: 'border-line2 text-dim',
    accent: 'border-[rgba(56,189,248,0.35)] text-accent bg-[rgba(56,189,248,0.08)]',
    green: 'border-[rgba(52,211,153,0.35)] text-sgreen bg-[rgba(52,211,153,0.08)]',
    yellow: 'border-[rgba(251,191,36,0.35)] text-syellow bg-[rgba(251,191,36,0.08)]',
    red: 'border-[rgba(248,113,113,0.35)] text-sred bg-[rgba(248,113,113,0.08)]',
    violet: 'border-[rgba(167,139,250,0.35)] text-[#A78BFA] bg-[rgba(167,139,250,0.08)]',
  }
  return <span className={`chip ${map[tone]}`}>{children}</span>
}

/* ---------- 按钮 ---------- */
export function Btn({ variant = 'ghost', size = 'md', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'success'; size?: 'sm' | 'md'
}) {
  const v = {
    primary: 'bg-accent2 hover:bg-accent text-[#03121F] font-medium border-transparent',
    ghost: 'bg-transparent hover:bg-[rgba(148,163,184,0.09)] text-dim hover:text-ink border-line2',
    danger: 'bg-[rgba(248,113,113,0.12)] hover:bg-[rgba(248,113,113,0.2)] text-sred border-[rgba(248,113,113,0.3)]',
    success: 'bg-[rgba(52,211,153,0.12)] hover:bg-[rgba(52,211,153,0.2)] text-sgreen border-[rgba(52,211,153,0.3)]',
  }[variant]
  const s = size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8.5 px-3.5 text-[13px]'
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${v} ${s} ${className}`}
      {...rest}
    />
  )
}

/* ---------- 页签 ---------- */
export function Tabs({ items, value, onChange }: { items: { key: string; label: ReactNode }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-line">
      {items.map((it) => (
        <button key={it.key} onClick={() => onChange(it.key)}
          className={`px-3.5 py-2 text-[13px] cursor-pointer border-b-2 -mb-px transition-colors duration-150 ${
            value === it.key ? 'border-accent text-accent font-medium' : 'border-transparent text-dim hover:text-ink'}`}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- 弹层 ---------- */
export function Modal({ open, onClose, title, children, width = 560 }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-[rgba(4,8,18,0.66)] backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative card fade-up max-h-[86vh] flex flex-col shadow-2xl" style={{ width, maxWidth: '94vw', background: '#131D33' }}>
        <header className="flex items-center justify-between px-5 py-3.5 hairline-b">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="关闭" className="text-dim hover:text-ink cursor-pointer p-1 rounded-md hover:bg-[rgba(148,163,184,0.1)]"><X size={16} /></button>
        </header>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-[rgba(4,8,18,0.6)]" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 flex flex-col border-l border-line2 shadow-2xl"
        style={{ width, maxWidth: '94vw', background: '#111A2E', animation: 'fadeUp 240ms cubic-bezier(0.22,1,0.36,1) both' }}>
        <header className="flex items-center justify-between px-5 py-3.5 hairline-b shrink-0">
          <h3 className="text-[14px] font-semibold pr-4">{title}</h3>
          <button onClick={onClose} aria-label="关闭" className="text-dim hover:text-ink cursor-pointer p-1 rounded-md hover:bg-[rgba(148,163,184,0.1)]"><X size={16} /></button>
        </header>
        <div className="p-5 overflow-y-auto grow">{children}</div>
      </div>
    </div>
  )
}

/* ---------- 表单 ---------- */
export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-dim mb-1.5">
        {label}{required && <span className="text-sred ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-faint mt-1">{hint}</span>}
    </label>
  )
}

const fieldCls = 'w-full h-9 px-3 rounded-lg bg-night2 border border-line2 text-[13px] text-ink placeholder:text-faint focus:border-accent transition-colors duration-150'

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldCls} ${p.className || ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldCls} cursor-pointer ${p.className || ''}`} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${fieldCls} h-auto py-2 leading-relaxed ${p.className || ''}`} />

/* ---------- 空态 ---------- */
export function Empty({ text = '暂无数据' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-faint">
      <EmptyArt />
      <span className="text-[12px]">{text}</span>
    </div>
  )
}

/* ---------- 进度条 ---------- */
export function Bar({ value, color = '#38BDF8', height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: 'rgba(148,163,184,0.12)' }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  )
}

/* ---------- Toast ---------- */
interface ToastMsg { id: number; text: string; tone: 'ok' | 'err' }
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastMsg[]>([])
  const push = (text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setList((l) => [...l, { id, text, tone }])
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3600)
  }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="card fade-up px-4 py-2.5 text-[13px] flex items-center gap-2 shadow-xl"
            style={{ background: '#16213A', borderColor: t.tone === 'ok' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.tone === 'ok' ? '#34D399' : '#F87171' }} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

/* ---------- 描述列表 ---------- */
export function DL({ items, cols = 3 }: { items: [string, ReactNode][]; cols?: number }) {
  return (
    <dl className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11.5px] text-faint mb-0.5">{k}</dt>
          <dd className="text-[13px] text-ink break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
