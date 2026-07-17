import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { api } from '../../api/client'
import { Btn, Card, Field, Input, Modal, Select, Tag, useToast } from '../../components/ui'
import { ROLE_LABEL } from '../../store/session'
import type { User } from '../../store/session'

interface UnitRow { id: number; name: string; short: string; kind: string }
interface AdminPeopleData {
  users: User[]
  units: UnitRow[]
}

const ROLE_OPTIONS: User['role'][] = ['leader', 'mgmt', 'team', 'chief', 'finance', 'admin']
const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'hq', label: '总部 (hq)' },
  { value: 'unit', label: '本单位 (unit)' },
  { value: 'channel', label: '层级渠道 (channel)' },
  { value: 'type', label: '项目类型 (type)' },
  { value: 'self', label: '本人 (self)' },
]

const EMPTY_FORM = {
  name: '',
  role: 'mgmt' as User['role'],
  scope: 'hq',
  unit_id: 7,
  title: '',
  emp_no: '',
  status: '在岗',
}

export default function PersonnelAdmin() {
  const toast = useToast()
  const [d, setD] = useState<AdminPeopleData | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const load = useCallback(() => {
    api.get<AdminPeopleData & { channels?: unknown[]; audit?: unknown[] }>('/admin').then((res) => {
      setD({ users: res.users || [], units: res.units || [] })
    }).catch((e) => toast((e as Error).message, 'err'))
  }, [toast])

  useEffect(() => { load() }, [load])

  const unitLabel = useMemo(() => {
    const map = new Map((d?.units || []).map((u) => [u.id, u.short || u.name]))
    return (id: number) => map.get(id) || String(id)
  }, [d])

  const openCreate = () => {
    setEditing(null)
    const defaultUnit = d?.units?.[0]?.id || 7
    setForm({ ...EMPTY_FORM, unit_id: defaultUnit })
    setOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name,
      role: u.role,
      scope: u.scope,
      unit_id: u.unit_id,
      title: u.title || '',
      emp_no: u.emp_no || '',
      status: u.status || '在岗',
    })
    setOpen(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      if (editing) {
        await api.put(`/admin/users/${editing.id}`, form)
        toast(`已更新「${form.name}」权限`)
      } else {
        await api.post('/admin/users', form)
        toast(`已添加人员「${form.name}」`)
      }
      setOpen(false)
      load()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (u: User) => {
    if (u.role === 'admin') {
      toast('系统超级管理员账号不可删除', 'err')
      return
    }
    if (!window.confirm(`确认删除人员「${u.name}」？此操作不可恢复。`)) return
    setBusy(true)
    try {
      await api.delete(`/admin/users/${u.id}`)
      toast(`已删除「${u.name}」`)
      load()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async (u: User) => {
    try {
      const r = await api.post<{ status: string }>(`/admin/users/${u.id}/status`)
      toast(r.status === '已离岗' ? '已离岗并回收权限' : '账号已恢复在岗')
      load()
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  if (!d) return <div className="text-faint text-sm py-16 text-center">加载人员清单…</div>

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold flex items-center gap-2">
            <Users size={15} className="text-accent" />
            人员权限管理
          </div>
          <div className="text-[11.5px] text-faint mt-0.5 max-w-[760px]">
            系统超级管理员负责人员添加、删除、角色与权限范围编辑；初始密码与六位工号相同。
          </div>
        </div>
        <Btn variant="primary" onClick={openCreate}><Plus size={14} />添加人员</Btn>
      </div>

      <Card pad={false} title={`账号清单（${d.users.length}）`}>
        <table className="dtable">
          <thead>
            <tr>
              <th>姓名</th>
              <th>工号</th>
              <th>角色</th>
              <th>权限范围</th>
              <th>单位</th>
              <th>职务说明</th>
              <th>状态</th>
              <th className="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {d.users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium whitespace-nowrap">{u.name}</td>
                <td className="num text-dim">{u.emp_no || '—'}</td>
                <td><Tag tone={u.role === 'admin' ? 'accent' : 'dim'}>{ROLE_LABEL[u.role]}</Tag></td>
                <td className="text-[12px] text-dim">{u.scope}</td>
                <td className="text-[12px] text-dim">{unitLabel(u.unit_id)}</td>
                <td className="text-[11.5px] text-faint max-w-[280px] truncate">{u.title}</td>
                <td><Tag tone={u.status === '在岗' ? 'green' : 'red'}>{u.status}</Tag></td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <Btn size="sm" onClick={() => openEdit(u)}><Pencil size={12} />编辑</Btn>
                    {u.role !== 'admin' && (
                      <>
                        <Btn size="sm" onClick={() => toggleStatus(u)}>{u.status === '在岗' ? '离岗' : '恢复'}</Btn>
                        <Btn size="sm" variant="danger" disabled={busy} onClick={() => remove(u)}><Trash2 size={12} />删除</Btn>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `编辑权限 · ${editing.name}` : '添加人员'}
        width={560}
      >
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓名" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="工号" required={!editing} hint="6 位数字，初始密码同工号">
              <Input
                className="num"
                maxLength={6}
                value={form.emp_no}
                onChange={(e) => setForm({ ...form, emp_no: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="角色" required>
              <Select
                value={form.role}
                disabled={editing?.role === 'admin'}
                onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </Select>
            </Field>
            <Field label="权限范围" required>
              <Select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                {SCOPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="所属单位" required>
              <Select
                value={String(form.unit_id)}
                onChange={(e) => setForm({ ...form, unit_id: Number(e.target.value) })}
              >
                {(d.units.length ? d.units : [{ id: 7, name: '总部', short: '总部', kind: 'hq' }]).map((u) => (
                  <option key={u.id} value={u.id}>{u.short || u.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="在岗状态">
              <Select
                value={form.status}
                disabled={editing?.role === 'admin'}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="在岗">在岗</option>
                <option value="已离岗">已离岗</option>
              </Select>
            </Field>
          </div>
          <Field label="职务 / 权限说明">
            <Input
              placeholder="如：总部总维护 / 科研项目主管"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setOpen(false)}>取消</Btn>
            <Btn
              variant="primary"
              disabled={busy || !form.name.trim() || (!editing && form.emp_no.length !== 6)}
              onClick={save}
            >
              {editing ? '保存权限' : '确认添加'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
