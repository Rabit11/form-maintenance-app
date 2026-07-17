let currentUserId = localStorage.getItem('srpm.user') || ''

export function setApiUser(id: string) {
  currentUserId = id
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-user': currentUserId,
        ...(options.headers || {}),
      },
    })
  } catch {
    throw new Error('无法连接服务器（Failed to fetch）。请确认地址为 http://主机:端口，并强制刷新页面后重试')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `请求失败 (${res.status})`)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body || {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** 文件上传（multipart，不能带 JSON content-type） */
export async function apiUpload(file: File): Promise<{ id: number; name: string; sizeKb: number }> {
  const fd = new FormData()
  fd.append('file', file)
  let res: Response
  try {
    res = await fetch('/api/uploads', { method: 'POST', headers: { 'x-user': currentUserId }, body: fd })
  } catch {
    throw new Error('上传连接失败，请检查网络后重试')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `上传失败 (${res.status})`)
  }
  return res.json()
}

/** 带登录身份的文件下载（避免 <a href> 丢失 x-user） */
export async function apiDownload(path: string, fallbackName = 'export.bin') {
  let res: Response
  try {
    res = await fetch(`/api${path}`, { headers: { 'x-user': currentUserId } })
  } catch {
    throw new Error('下载连接失败，请检查网络后重试')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `下载失败 (${res.status})`)
  }
  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition') || ''
  const encoded = disp.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  const plain = disp.match(/filename\s*=\s*"([^"]+)"/i)?.[1]
    || disp.match(/filename\s*=\s*([^;\s]+)/i)?.[1]
  let name = plain || fallbackName
  if (encoded) {
    try { name = decodeURIComponent(encoded) } catch { /* 使用普通文件名兜底 */ }
  }
  name = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[.\s]+$/g, '') || fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return name
}
