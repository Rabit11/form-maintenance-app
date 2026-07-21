import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** 密码哈希：salt:hex（scrypt） */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(String(password), salt, 64);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** 对外返回的用户对象：去掉 password_hash */
export function publicUser(row) {
  if (!row) return null;
  const { password_hash: _ph, ...rest } = row;
  return {
    ...rest,
    must_change_password: Number(row.must_change_password) === 1 ? 1 : 0,
  };
}

/** 校验新密码规则：至少 6 位，且不得与工号相同 */
export function assertNewPassword(password, empNo) {
  const pwd = String(password ?? '');
  if (pwd.length < 6) return { error: '新密码至少 6 位' };
  if (empNo && pwd === String(empNo)) return { error: '新密码不能与工号相同' };
  return { ok: true, password: pwd };
}
