import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../api/client'
import { Btn, Card, Tabs, Tag, Empty, Modal, Field, Input, Select, useToast } from '../../components/ui'
import { ROLE_LABEL } from '../../store/session'
import type { User } from '../../store/session'
import { IconChannel, IconFlow, IconAudit, IconAdmin } from '../../components/icons'

interface AdminData {
  channels: { id: number; key: string; name: string; level: string; org: string; dept: string; flow: string[]; declare: string[]; filing: string[]; chain: string[]; declare_mode: string; assess: string[]; enabled: number }[]
  users: User[]
  audit: { id: number; ts: string; user_name: string; action: string; target: string; detail: string }[]
}

const ROLES = ['leader', 'mgmt', 'team', 'chief', 'finance', 'admin'] as const

const PERMS: { label: string; roles: Record<User['role'], string> }[] = [
  { label: '人员类型', roles: { leader: '公司领导', team: '项目责任人 / 技术责任人 / 项目主管', chief: '一级总师 / 二级总师', mgmt: '总部处长主管 / 单位管理负责人 / 单位项目主管', finance: '二级单位财务负责人 / 经办', admin: '科研项目处指定人员' } },
  { label: '项目数据查看', roles: { leader: '领导只读视图', team: '仅本人关联项目', chief: '本人经手项目', mgmt: '总部全公司 / 单位本单位', finance: '本单位项目经费台账', admin: '全平台（运维视角）' } },
  { label: '成果转化台账', roles: { leader: '只读查看', team: '关联项目基础信息填报', chief: '经手项目查看', mgmt: '审核 / 备案 / 进度督办', finance: '无', admin: '配置入口' } },
  { label: '数据填报/编辑', roles: { leader: '—（无修改权限）', team: '提交保存前可编辑', chief: '—（无修改权限）', mgmt: '—（无修改权限）', finance: '—（无修改权限）', admin: '禁止修改业务数据' } },
  { label: '全量数据导出', roles: { leader: '默认不开放', team: '无', chief: '无', mgmt: '总部支持导出', finance: '无', admin: '无' } },
  { label: '审批/评审职能', roles: { leader: '无', team: '发起流程 / 配合审核验收', chief: '技术指导 / 重要节点审核', mgmt: '组织评价 / 统筹管理', finance: '经费核对 / 异常监管', admin: '流程模板维护' } },
  { label: '可视化看板', roles: { leader: '只读查看', team: '无', chief: '一级总师可见', mgmt: '管理分析模块', finance: '经费维度', admin: '无' } },
  { label: '后评价', roles: { leader: '暂缓', team: '暂缓', chief: '暂缓', mgmt: '暂缓', finance: '暂缓', admin: '暂缓' } },
]

const ACCOUNT_NOTES: Record<User['role'], string> = {
  leader: '领导账号用于决策查看，不提供业务修改入口。',
  team: '项目团队账号按项目责任人、技术责任人、项目主管拆分，均按本人关联项目授权。',
  chief: '责任总师账号区分一级公司级总师与二级单位级总师，按经手项目查看。',
  mgmt: '管理团队账号区分总部与单位范围，总部可看全公司，单位账号仅看本单位。',
  finance: '财务团队账号按二级单位财务负责人、经办配置，聚焦本单位经费台账。',
  admin: '系统超级管理员负责人员添加、删除、权限编辑，以及字典/流程/运维配置。',
}

export default function Admin() {
  const toast = useToast()
  const [tab, setTab] = useState('dict')
  const [d, setD] = useState<AdminData | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [chForm, setChForm] = useState({ key: '', name: '', level: '公司级', org: '', dept: '科研项目处', declare: '', filing: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { api.get<AdminData>('/admin').then(setD) }, [])
  useEffect(load, [load])

  const addChannel = async () => {
    setBusy(true)
    try {
      await api.post('/admin/channels', chForm)
      toast(`渠道「${chForm.name}」已入库，编码 ${chForm.key.toUpperCase()}`)
      setAddOpen(false); setChForm({ key: '', name: '', level: '公司级', org: '', dept: '科研项目处', declare: '', filing: '' }); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const toggleChannel = async (id: number) => {
    try { await api.post(`/admin/channels/${id}/toggle`); load() } catch (e) { toast((e as Error).message, 'err') }
  }
  const toggleUser = async (id: string) => {
    try {
      const r = await api.post<{ status: string }>(`/admin/users/${id}/status`)
      toast(r.status === '已离岗' ? '账号权限已自动回收（7 个工作日内完成注销/移交）' : '账号已恢复在岗')
      load()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  if (!d) return <div className="text-faint text-sm py-20 text-center">加载中…</div>
  const usersByRole = (role: User['role']) => d.users.filter((x) => x.role === role)

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="text-[12px] text-faint flex items-center gap-2">
        <IconAdmin size={14} />
        系统超级管理员：人员添加/删除/权限编辑 · 平台权限与字典运维 · 岗位变动自动回收权限，7 个工作日内完成账号移交
      </div>
      <Tabs value={tab} onChange={setTab} items={[
        { key: 'dict', label: '渠道字典' },
        { key: 'perm', label: '角色权限矩阵' },
        { key: 'flow', label: '流程模板' },
        { key: 'audit', label: '审计日志' },
      ]} />

      {tab === 'dict' && (
        <Card title={<span className="flex items-center gap-2"><IconChannel size={15} />项目渠道分类字典（编码全局唯一）</span>}
          extra={<span className="flex items-center gap-3">
            <span className="text-[11px] text-faint">新增/终止渠道须责任单位科技部申请，总部审批后由系统超级管理员维护</span>
            <Btn size="sm" variant="primary" onClick={() => setAddOpen(true)}><Plus size={13} />新增渠道</Btn>
          </span>} pad={false}>
          <table className="dtable">
            <thead><tr><th>编码</th><th>渠道名称</th><th>层级</th><th>渠道部门</th><th>内部管理处室</th><th>申报模式</th><th>评估检查</th><th>状态</th><th></th></tr></thead>
            <tbody>
              {d.channels.map((c) => (
                <tr key={c.id} className={c.enabled === 0 ? 'opacity-45' : ''}>
                  <td className="num text-accent">{c.key}</td>
                  <td className="font-medium max-w-[220px] truncate">{c.name}</td>
                  <td><Tag tone={c.level === '国家级' ? 'accent' : c.level === '地方级' ? 'violet' : 'dim'}>{c.level}</Tag></td>
                  <td className="text-dim">{c.org}</td>
                  <td className="text-dim">{c.dept}</td>
                  <td><Tag tone={c.declare_mode === '报备' ? 'green' : 'dim'}>{c.declare_mode}</Tag></td>
                  <td className="text-[11.5px] text-faint max-w-[160px] truncate">{c.assess.join('、') || '/'}</td>
                  <td><Tag tone={c.enabled ? 'green' : 'red'}>{c.enabled ? '启用' : '已终止'}</Tag></td>
                  <td className="text-right">
                    <Btn size="sm" variant={c.enabled ? 'danger' : 'success'} onClick={() => toggleChannel(c.id)}>{c.enabled ? '终止' : '启用'}</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'perm' && (
        <Card title="角色权限矩阵与账号清单（需求 V19 第5页 §二(二)角色定义）" pad={false}>
          <table className="dtable">
            <thead>
              <tr>
                <th>权限项</th>
                {ROLES.map((r) => <th key={r}>{ROLE_LABEL[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((p) => (
                <tr key={p.label}>
                  <td className="font-medium">{p.label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className={`text-[12px] ${p.roles[r].startsWith('无') || p.roles[r].startsWith('—') || p.roles[r].startsWith('禁止') ? 'text-faint' : 'text-dim'}`}>
                      {p.roles[r]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="font-medium">账号人员<span className="block text-[10px] text-faint font-normal">按 V19 人员类型拆分</span></td>
                {ROLES.map((r) => {
                  const users = usersByRole(r)
                  return (
                    <td key={r}>
                      <div className="flex flex-col gap-1.5">
                        {users.map((u) => (
                          <div key={u.id} className="flex flex-wrap items-center gap-1.5">
                            <Tag tone="accent">{u.name}</Tag>
                            <span className="text-[10.5px] text-faint">{u.title}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td className="font-medium">账号状态<span className="block text-[10px] text-faint font-normal">离岗自动回收权限；管理员 7 个工作日内注销/移交</span></td>
                {ROLES.map((r) => {
                  const users = usersByRole(r)
                  if (!users.length) return <td key={r}>—</td>
                  return (
                    <td key={r}>
                      <div className="flex flex-col gap-1.5">
                        {users.map((u) => (
                          <span key={u.id} className="flex items-center gap-2">
                            <span className="text-[11px] text-dim min-w-[48px]">{u.name}</span>
                            <Tag tone={u.status === '在岗' ? 'green' : 'red'}>{u.status}</Tag>
                            {u.role !== 'admin' && (
                              <Btn size="sm" onClick={() => toggleUser(u.id)}>{u.status === '在岗' ? '离岗' : '恢复'}</Btn>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td className="font-medium">配置说明</td>
                {ROLES.map((r) => <td key={r} className="text-[12px] text-faint">{ACCOUNT_NOTES[r]}</td>)}
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="新增项目渠道（编码全局唯一）" width={520}>
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint">流程：责任单位科技部提交申请 → 总部科技部审批 → 系统超级管理员维护入库（本操作即维护入库动作，全程审计留痕）。</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="渠道编码" required><Input placeholder="如 XNY01（唯一）" value={chForm.key} onChange={(e) => setChForm({ ...chForm, key: e.target.value })} /></Field>
            <Field label="层级" required>
              <Select value={chForm.level} onChange={(e) => setChForm({ ...chForm, level: e.target.value })}>
                {['国家级', '地方级', '公司级'].map((l) => <option key={l}>{l}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="渠道名称" required><Input placeholder="如：新能源航空动力专项" value={chForm.name} onChange={(e) => setChForm({ ...chForm, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="渠道部门"><Input placeholder="部委/司局" value={chForm.org} onChange={(e) => setChForm({ ...chForm, org: e.target.value })} /></Field>
            <Field label="内部管理处室">
              <Select value={chForm.dept} onChange={(e) => setChForm({ ...chForm, dept: e.target.value })}>
                {['科研项目处', '科技发展处', '技术基础处'].map((x) => <option key={x}>{x}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="申报材料" hint="多项以顿号分隔"><Input placeholder="建议书、建议书评审" value={chForm.declare} onChange={(e) => setChForm({ ...chForm, declare: e.target.value })} /></Field>
          <Field label="立项材料" hint="多项以顿号分隔"><Input placeholder="立项通知" value={chForm.filing} onChange={(e) => setChForm({ ...chForm, filing: e.target.value })} /></Field>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setAddOpen(false)}>取消</Btn>
            <Btn variant="primary" disabled={busy || !chForm.key.trim() || !chForm.name.trim()} onClick={addChannel}>维护入库</Btn>
          </div>
        </div>
      </Modal>

      {tab === 'flow' && (
        <div className="grid grid-cols-2 gap-4">
          {d.channels.map((c) => (
            <Card key={c.id} title={<span className="flex items-center gap-2"><IconFlow size={15} />{c.name}</span>}
              extra={<Tag tone={c.level === '国家级' ? 'accent' : c.level === '地方级' ? 'violet' : 'dim'}>{c.level}</Tag>}>
              <div className="text-[11px] text-faint mb-2">全周期管理流程</div>
              <div className="flex flex-wrap items-center gap-y-1.5 mb-3">
                {c.flow.map((s, i) => (
                  <span key={i} className="flex items-center">
                    <span className="px-1.5 py-0.5 rounded bg-[rgba(56,189,248,0.08)] border border-[rgba(56,189,248,0.2)] text-accent text-[10.5px] whitespace-nowrap">{s}</span>
                    {i < c.flow.length - 1 && <span className="text-faint text-[10px] mx-0.5">→</span>}
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-faint mb-1.5">申报审签链</div>
              <div className="text-[10.5px] text-dim leading-5">{c.chain.join(' → ')}<span className="text-faint"> →（线下报批归档）</span></div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <Card title={<span className="flex items-center gap-2"><IconAudit size={15} />平台审计日志（全程留痕 · 可追溯）</span>} pad={false}>
          <table className="dtable">
            <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th></tr></thead>
            <tbody>
              {d.audit.map((a) => (
                <tr key={a.id}>
                  <td className="num text-dim text-[11.5px]">{a.ts}</td>
                  <td>{a.user_name === '系统' || a.user_name === '系统管理员' ? <Tag>{a.user_name}</Tag> : a.user_name}</td>
                  <td><Tag tone={a.action.includes('驳回') || a.action.includes('黑名单') || a.action.includes('预警') ? 'red' : a.action.includes('通过') || a.action.includes('办结') || a.action.includes('拨付') ? 'green' : 'accent'}>{a.action}</Tag></td>
                  <td className="text-dim max-w-[220px] truncate">{a.target}</td>
                  <td className="text-[11.5px] text-faint max-w-[380px] truncate">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.audit.length === 0 && <Empty />}
        </Card>
      )}
    </div>
  )
}
