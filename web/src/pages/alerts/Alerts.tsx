import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { AlertRow } from '../../api/types'
import { Card, StatusDot, Tag, Empty, Select } from '../../components/ui'
import { fmtDate } from '../../lib/format'

export default function Alerts() {
  const nav = useNavigate()
  const [rows, setRows] = useState<AlertRow[] | null>(null)
  const [level, setLevel] = useState('')
  const [kind, setKind] = useState('')

  useEffect(() => { api.get<AlertRow[]>('/alerts').then(setRows) }, [])

  const list = useMemo(() => (rows || []).filter((a) => (!level || a.level === level) && (!kind || a.kind === kind)), [rows, level, kind])
  const kinds = useMemo(() => Array.from(new Set((rows || []).map((a) => a.kind))), [rows])
  const red = (rows || []).filter((a) => a.level === 'red').length
  const yellow = (rows || []).filter((a) => a.level === 'yellow').length

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-center gap-4">
        <div className="card px-4 py-3 flex items-center gap-3">
          <StatusDot color="red" pulse />
          <span className="num text-[22px] font-bold text-sred">{red}</span>
          <span className="text-[11.5px] text-dim">逾期告警<br /><span className="text-faint">到期当日自动触发</span></span>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <StatusDot color="yellow" />
          <span className="num text-[22px] font-bold text-syellow">{yellow}</span>
          <span className="text-[11.5px] text-dim">临期预警<br /><span className="text-faint">到期前 30 天自动触发</span></span>
        </div>
        <div className="text-[11.5px] text-faint leading-5">
          预警推送：平台站内消息 + 企业邮箱 + 蓝信<br />推送对象：项目团队、对应管理团队
        </div>
        <div className="grow" />
        <Select aria-label="级别" value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 120, height: 32 }}>
          <option value="">全部级别</option><option value="red">红色·逾期</option><option value="yellow">黄色·临期</option>
        </Select>
        <Select aria-label="类型" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 120, height: 32 }}>
          <option value="">全部类型</option>
          {kinds.map((k) => <option key={k}>{k}</option>)}
        </Select>
      </div>

      <Card pad={false}>
        {list.length === 0 && <Empty text="暂无预警" />}
        {list.map((a) => (
          <button key={a.id} onClick={() => a.project_id && nav(`/projects/${a.project_id}`)}
            className="w-full text-left px-5 py-3 hairline-b flex items-center gap-3.5 cursor-pointer hover:bg-[rgba(56,189,248,0.04)] transition-colors">
            <StatusDot color={a.level} pulse={a.level === 'red'} />
            <div className="grow min-w-0">
              <div className="text-[13px] leading-5">{a.title}</div>
              <div className="text-[11px] text-faint mt-0.5 flex items-center gap-2.5">
                <Tag>{a.kind}</Tag>
                {a.pcode && <span className="num">{a.pcode}</span>}
                <span>触发 {fmtDate(a.created_at)}</span>
                <span>推送：{a.channels}</span>
              </div>
            </div>
            {a.due && <span className={`num text-[11.5px] shrink-0 ${a.level === 'red' ? 'text-sred' : 'text-syellow'}`}>到期 {fmtDate(a.due)}</span>}
          </button>
        ))}
      </Card>
    </div>
  )
}
