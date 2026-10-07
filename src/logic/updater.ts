import Constants from 'expo-constants';

const REPO = 'JOETONGJY/shazi-jizhang';
const CHECK_TIMEOUT_MS = 10_000;
/** GitHub 资产加速镜像（国内直连 release 资产经常完全超时），失败按序回退 */
const DOWNLOAD_MIRRORS = ['https://gh-proxy.com/', 'https://ghproxy.net/'];

/** APK 下载地址候选：直连优先，失败依次切镜像 */
export function apkDownloadCandidates(url: string): string[] {
  return [url, ...DOWNLOAD_MIRRORS.map((m) => m + url)];
}

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
 * 网络失败抛错（调用方决定是否静默）；有响应但无新版本返回 null。
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), CHECK_TIMEOUT_MS);
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: abort.signal,
  }).finally(() => clearTimeout(timer));
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
}
