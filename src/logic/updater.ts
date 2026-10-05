import Constants from 'expo-constants';

const REPO = 'JOETONGJY/shazi-jizhang';

export interface UpdateInfo {
  /** 新版本号（不含v前缀），如 1.0.1 */
  version: string;
  /** Release 说明原文 */
  notes: string;
  /** APK 下载地址 */
  apkUrl: string;
  /** 资产大小（字节） */
  size: number;
}

function normVer(v: string): number[] {
  const parts = v.replace(/^v/i, '').split('-')[0].split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  return parts;
}

/** 语义比较：remote 是否比 local 新 */
export function isNewer(remote: string, local: string): boolean {
  const a = normVer(remote);
  const b = normVer(local);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * 查询 GitHub 最新 Release，与本地版本比较。
 * 网络失败/无新版本返回 null（静默）。
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tag: string = data.tag_name ?? '';
    if (!tag) return null;
    if (!isNewer(tag, currentVersion())) return null;
    const assets: Array<{ name: string; browser_download_url: string; size: number }> = data.assets ?? [];
    const apk = assets.find((a) => a.name.endsWith('.apk'));
    if (!apk) return null;
    return {
      version: tag.replace(/^v/i, ''),
      notes: data.body ?? '',
      apkUrl: apk.browser_download_url,
      size: apk.size,
    };
  } catch {
    return null;
  }
}
