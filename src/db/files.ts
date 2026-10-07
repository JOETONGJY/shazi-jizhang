import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import { dbFile, getDb, initDb, setDb } from './database';
import { backupFileName, txToCsv } from '../logic/csv';
import { getMeta, setMeta, listTxAll } from './repo';

const SAF = LegacyFS.StorageAccessFramework;
const BACKUP_DIR_META_KEY = 'backup_dir_uri';
const SAF_KEEP = 3;

/** 用户授权的持久备份文件夹（SAF，卸载后文件夹仍在）；未设置返回 null */
export function getBackupDirUri(): string | null {
  const v = getMeta(BACKUP_DIR_META_KEY, '');
  return v !== '' ? v : null;
}

export async function setBackupDirUri(uri: string | null): Promise<void> {
  setMeta(BACKUP_DIR_META_KEY, uri ?? '');
}

/** 把当前数据库写入 SAF 文件夹（base64 中转），滚动保留最近 SAF_KEEP 份 */
async function backupToDir(dirUri: string): Promise<string> {
  const base64 = await LegacyFS.readAsStringAsync(dbFile().uri, { encoding: LegacyFS.EncodingType.Base64 });
  const name = backupFileName(new Date());
  const fileUri = await SAF.createFileAsync(dirUri, name, 'application/octet-stream');
  await LegacyFS.writeAsStringAsync(fileUri, base64, { encoding: LegacyFS.EncodingType.Base64 });
  // 滚动清理：名字含 jizhang- 且字典序即时间序
  try {
    const uris = await SAF.readDirectoryAsync(dirUri);
    const ours = uris
      .filter((u) => decodeURIComponent(u).includes('/jizhang-'))
      .sort()
      .reverse();
    for (const old of ours.slice(SAF_KEEP)) {
      await SAF.deleteAsync(old).catch(() => {});
    }
  } catch {
    // 清理失败不影响本次备份
  }
  return fileUri;
}

/** 确保安装更新前有一份外部可达的备份：SAF 文件夹优先，否则弹分享面板 */
export async function ensureBackupBeforeInstall(): Promise<{ msg: string }> {
  const dir = getBackupDirUri();
  if (dir) {
    await backupToDir(dir);
    return { msg: '已把数据备份到自动备份文件夹' };
  }
  const f = await createBackup(3);
  const ok = await share(f);
  return { msg: ok ? '已生成备份，请在分享面板选择保存位置（如「保存到文件」）' : `备份已生成：${f.name}` };
}

export function backupDir(): Directory {
  return new Directory(Paths.document, 'jizhang-backups');
}

export function backupCount(): number {
  try {
    const dir = backupDir();
    if (!dir.exists) return 0;
    return dir.list().filter((e) => e instanceof File && e.name.endsWith('.db')).length;
  } catch {
    return 0;
  }
}

/** 生成一份备份文件并返回；keep=保留最近份数 */
export async function createBackup(keep = 3): Promise<File> {
  const dir = backupDir();
  dir.create({ idempotent: true, intermediates: true });
  const target = new File(dir, backupFileName(new Date()));
  target.write(await dbFile().bytes());
  const files = dir.list()
    .filter((e): e is File => e instanceof File && e.name.endsWith('.db'))
    .sort((a, b) => a.name.localeCompare(b.name));
  while (files.length > keep) {
    const oldest = files.shift();
    if (oldest) oldest.delete();
  }
  return target;
}

/** 退到后台时调用：静默自动备份，失败不影响使用 */
export function autoBackup(): void {
  void (async () => {
    try {
      await createBackup(3); // 私有目录滚动备份（防数据库损坏）
    } catch {
      // 备份失败不打扰用户
    }
    const dir = getBackupDirUri();
    if (dir) {
      try {
        await backupToDir(dir); // 用户文件夹备份（卸载也不丢）
      } catch {
        // 同上
      }
    }
  })();
}

async function share(file: File): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri);
  return true;
}

/** 导出全量账单 CSV（用系统分享面板，可存文件/发给自己） */
export async function exportCsv(): Promise<{ ok: boolean; msg: string }> {
  try {
    const csv = txToCsv(listTxAll());
    const f = new File(Paths.cache, `jizhang-export-${Date.now()}.csv`);
    f.write(csv);
    const ok = await share(f);
    return ok ? { ok: true, msg: '已生成，请在分享面板选择保存位置' } : { ok: false, msg: '当前设备不支持分享面板' };
  } catch (e) {
    return { ok: false, msg: `导出失败：${String(e)}` };
  }
}

/** 手动备份到文件并分享出去 */
export async function shareBackup(): Promise<{ ok: boolean; msg: string }> {
  try {
    const f = await createBackup(3);
    const ok = await share(f);
    return ok ? { ok: true, msg: `备份完成：${f.name}` } : { ok: false, msg: `备份已生成但无法分享：${f.name}` };
  } catch (e) {
    return { ok: false, msg: `备份失败：${String(e)}` };
  }
}

/** 从备份文件恢复：覆盖当前数据库并重新打开 */
export async function restoreFrom(fileUri: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const src = new File(fileUri);
    if (!src.exists) return { ok: false, msg: '文件不存在' };
    if (src.size > 50 * 1024 * 1024) return { ok: false, msg: '文件过大，不是有效的备份' };
    getDb().closeSync();
    setDb(null);
    dbFile().write(await src.bytes());
    initDb();
    return { ok: true, msg: '恢复成功' };
  } catch (e) {
    try {
      initDb();
    } catch {
      // 恢复失败后至少保证数据库可用
    }
    return { ok: false, msg: `恢复失败：${String(e)}` };
  }
}
