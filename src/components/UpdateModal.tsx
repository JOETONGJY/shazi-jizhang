import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as LegacyFS from 'expo-file-system/legacy';
import { useApp } from '../state/AppStore';
import type { UpdateInfo } from '../logic/updater';
import { fmtMoney } from '../logic/stats';

type Phase = 'idle' | 'downloading' | 'ready';

/** 应用内更新弹窗：发现新版本 → 下载APK（带进度）→ 拉起系统安装器 */
export function UpdateModal({ info, localVersion, onClose }: { info: UpdateInfo; localVersion: string; onClose: () => void }) {
  const { palette } = useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const [apkUri, setApkUri] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (phase !== 'downloading') return;
    (async () => {
      try {
        const dest = (LegacyFS.cacheDirectory ?? '') + 'shazi-jizhang-update.apk';
        const resumable = LegacyFS.createDownloadResumable(
          info.apkUrl,
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
        } else {
          setErr('下载失败，请检查网络后重试');
          setPhase('idle');
        }
      } catch (e) {
        if (!cancelled) {
          setErr(`下载失败：${String(e).slice(0, 60)}`);
          setPhase('idle');
        }
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
      setErr('无法启动安装，请允许"安装未知应用"权限后重试');
    }
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
                下载中 {Math.round(progress * 100)}%
              </Text>
            </View>
          ) : err !== '' ? (
            <Text style={{ fontSize: 11.5, color: palette.danger, marginTop: 12, textAlign: 'center' }}>{err}</Text>
          ) : phase === 'ready' ? (
            <TouchableOpacity style={[st.btn, { backgroundColor: palette.primary, marginTop: 14 }]} onPress={openInstaller}>
              <Text style={{ color: palette.onAccent, fontWeight: '800', fontSize: 15 }}>安装更新</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[st.btn, { backgroundColor: palette.primary, marginTop: 14 }]} onPress={() => setPhase('downloading')}>
              <Text style={{ color: palette.onAccent, fontWeight: '800', fontSize: 15 }}>立即更新</Text>
            </TouchableOpacity>
          )}

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
