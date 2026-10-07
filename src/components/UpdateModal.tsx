import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as LegacyFS from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { useApp } from '../state/AppStore';
import { apkDownloadCandidates, type UpdateInfo } from '../logic/updater';
import { ensureBackupBeforeInstall } from '../db/files';
import { fmtMoney } from '../logic/stats';

type Phase = 'idle' | 'downloading' | 'ready';

const ANDROID_MANAGE_UNKNOWN_APPS = 'android.settings.MANAGE_UNKNOWN_APPS_SOURCES';
const PACKAGE_NAME = Constants.expoConfig?.android?.package ?? '';

/** 应用内更新弹窗：发现新版本 → 下载APK（直连失败自动切镜像，带进度）→ 拉起系统安装器 */
export function UpdateModal({ info, localVersion, onClose }: { info: UpdateInfo; localVersion: string; onClose: () => void }) {
  const { palette } = useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState('直连');
  const [err, setErr] = useState('');
  const [needPerm, setNeedPerm] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [apkUri, setApkUri] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (phase !== 'downloading') return;
    (async () => {
      const candidates = apkDownloadCandidates(info.apkUrl);
      for (let i = 0; i < candidates.length; i++) {
        try {
          if (cancelled) return;
          setSource(i === 0 ? '直连' : `镜像${i}`);
          setProgress(0);
          const dest = (LegacyFS.cacheDirectory ?? '') + `shazi-jizhang-update-${i}.apk`;
          // 换源重试前清掉上一源的半截文件
          await LegacyFS.deleteAsync(dest, { idempotent: true }).catch(() => {});
          const resumable = LegacyFS.createDownloadResumable(
            candidates[i],
            dest,
            {},
            (p) => {
              if (!cancelled && p.totalBytesExpectedToWrite > 0) {
                setProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
              }
            },
          );
          const result = await resumable.downloadAsync();
          if (cancelled) return;
          if (result?.uri) {
            setApkUri(result.uri);
            setPhase('ready');
            return;
          }
        } catch {
          // 当前源失败，静默换下一个
        }
      }
      if (!cancelled) {
        setErr('下载失败：直连和镜像都不可用，请稍后再试');
        setPhase('idle');
      }
    })();
    return () => { cancelled = true; };
  }, [phase, info.apkUrl]);

  async function openInstaller() {
    try {
      const contentUri = await LegacyFS.getContentUriAsync(apkUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
      onClose();
    } catch (e) {
      setNeedPerm(true);
      setErr('需要「安装未知应用」权限');
    }
  }

  function openPermSettings() {
    IntentLauncher.startActivityAsync(ANDROID_MANAGE_UNKNOWN_APPS, {
      data: `package:${PACKAGE_NAME}`,
    }).catch(() => {});
  }

  async function backupThenInstall() {
    setPreparing(true);
    try {
      const r = await ensureBackupBeforeInstall();
      setBackupMsg(r.msg);
    } catch {
      setBackupMsg('自动备份未完成，继续安装（可在「我的」手动备份）');
    }
    setPreparing(false);
    await openInstaller();
  }

  const sizeMb = (info.size / 1024 / 1024).toFixed(1);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={[st.box, { backgroundColor: palette.card }]}>
          <View style={st.headRow}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: palette.text }}>发现新版本</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: palette.primary }}>v{info.version}</Text>
          </View>

          <Text style={{ fontSize: 12, color: palette.sub, marginTop: 6 }}>
            安装包 {sizeMb} MB · 当前版本 v{localVersion}
          </Text>

          <View style={[st.notesBox, { backgroundColor: palette.keyFnBg }]}>
            <Text style={{ fontSize: 12, color: palette.text, lineHeight: 20 }}>{info.notes || '体验优化与问题修复'}</Text>
          </View>

          {phase === 'downloading' ? (
            <View style={{ marginTop: 14 }}>
              <View style={[st.pbarBg, { backgroundColor: palette.keyFnBg }]}>
                <View style={{
                  height: 8, borderRadius: 4,
                  width: `${Math.max(Math.round(progress * 100), 2)}%` as `${number}%`,
                  backgroundColor: palette.primary,
                }} />
              </View>
              <Text style={{ fontSize: 11, color: palette.faint, textAlign: 'center', marginTop: 6 }}>
                {source}下载中 {Math.round(progress * 100)}%
              </Text>
            </View>
          ) : phase === 'ready' ? (
            <>
              <TouchableOpacity
                style={[st.btn, { backgroundColor: palette.primary, marginTop: 14, opacity: preparing ? 0.6 : 1 }]}
                disabled={preparing}
                onPress={() => { void backupThenInstall(); }}
              >
                <Text style={{ color: palette.onAccent, fontWeight: '800', fontSize: 15 }}>{preparing ? '正在备份…' : '安装更新'}</Text>
              </TouchableOpacity>
              {needPerm && (
                <TouchableOpacity style={[st.btn, { borderColor: palette.primary, borderWidth: 1, marginTop: 10 }]} onPress={openPermSettings}>
                  <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 14 }}>去开启安装权限</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity style={[st.btn, { backgroundColor: palette.primary, marginTop: 14 }]} onPress={() => setPhase('downloading')}>
              <Text style={{ color: palette.onAccent, fontWeight: '800', fontSize: 15 }}>立即更新</Text>
            </TouchableOpacity>
          )}
          {err !== '' && phase !== 'downloading' ? (
            <Text style={{ fontSize: 11.5, color: palette.danger, marginTop: 10, textAlign: 'center' }}>{err}</Text>
          ) : null}
          {backupMsg !== '' && phase === 'ready' ? (
            <Text style={{ fontSize: 11, color: palette.faint, marginTop: 8, textAlign: 'center' }}>{backupMsg}</Text>
          ) : null}

          {phase !== 'downloading' && (
            <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', padding: 10 }}>
              <Text style={{ fontSize: 13, color: palette.faint }}>{phase === 'ready' ? '稍后安装' : '暂不更新'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,10,25,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  box: { width: '100%', borderRadius: 22, padding: 20 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notesBox: { borderRadius: 12, padding: 12, marginTop: 10, maxHeight: 150 },
  pbarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  btn: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
