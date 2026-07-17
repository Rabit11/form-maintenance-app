import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Project, ProjectFull, PlanRow } from '../../api/types'
import { Btn, Card, FourBadge, Tabs, Tag, useToast, Empty } from '../../components/ui'
import { fmtDate } from '../../lib/format'

interface Row extends PlanRow { pname: string; pcode: string }

export default function Plans() {
  const toast = useToast()
  const [tab, setTab] = useState('todo')
  const [rows, setRows] = useState<Row[]>([])
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    const projects = await api.get<Project[]>('/projects')
    const details = await Promise.all(projects.filter((p) => p.msTotal > 0).map((p) => api.get<ProjectFull>(`/projects/${p.id}`)))
    setRows(details.flatMap((d) => d.plans.map((x) => ({ ...x, pname: d.name, pcode: d.code }))))
    api.get<{ cmos: string | null }>('/sync/status').then((s) => setLastSync(s.cmos)).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const syncNow = async () => {
    setSyncing(true)
    try {
      const r = await api.post<{ added: number; closed: number; at: string }>('/sync/cmos')
      toast(`CMOS 同步完成：拉取计划 ${r.added} 条，回写办结 ${r.closed} 条`)
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setSyncing(false) }
  }

  const list = useMemo(() => rows
    .filter((x) => tab === 'todo' ? x.status !== '已完成' : x.status === '已完成')
    .sort((a, b) => a.due.localeCompare(b.due)), [rows, tab])

  const finish = async (x: Row) => {
    try {
      await api.post(`/plans/${x.id}/finish`)
      toast('办结申请已提交，等待二级单位管理团队终审')
      load()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-faint">计划数据由 CMOS 系统自动导入实时同步 · 待办计划完成后提交办结申请 → 二级单位管理团队终审 → 自动转入已完成计划</div>
        <div className="flex items-center gap-2.5">
          <Tag tone="accent">{lastSync ? `上次同步 ${lastSync.slice(5, 16)}` : 'CMOS 同步正常 · 今日 06:00'}</Tag>
          <Btn size="sm" disabled={syncing} onClick={syncNow}>{syncing ? '同步中…' : '立即同步 CMOS'}</Btn>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[
        { key: 'todo', label: `待办计划 ${rows.filter((x) => x.status !== '已完成').length}` },
        { key: 'done', label: `已完成计划 ${rows.filter((x) => x.status === '已完成').length}` },
      ]} />
      <Card pad={false}>
        <table className="dtable">
          <thead><tr><th>计划内容</th><th>所属项目</th><th>来源</th><th>完成时限</th><th>四色状态</th>{tab === 'todo' && <th style={{ width: 120 }}></th>}{tab === 'done' && <th>完成时间</th>}</tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td className="font-medium max-w-[360px] truncate">{x.title}</td>
                <td className="text-dim max-w-[240px] truncate">{x.pname}</td>
                <td><Tag>{x.source}</Tag></td>
                <td className="num text-dim">{fmtDate(x.due)}</td>
                <td><FourBadge color={x.color} label={x.status === '办结审批中' ? '办结审批中' : undefined} /></td>
                {tab === 'todo' && (
                  <td className="text-right">
                    {x.status === '待办'
                      ? <Btn size="sm" variant="success" onClick={() => finish(x)}>提交办结</Btn>
                      : <span className="text-[11px] text-accent">终审中…</span>}
                  </td>
                )}
                {tab === 'done' && <td className="num text-sgreen">{fmtDate(x.done_at)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty text={tab === 'todo' ? '暂无待办计划' : '暂无已完成计划'} />}
      </Card>
    </div>
  )
}
