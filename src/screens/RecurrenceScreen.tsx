import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../state/AppStore';
import { addRecurrence, deleteRecurrence, listAccounts, listRecurrences, setRecurrenceActive, topCategories, subCategories } from '../db/repo';
import { fmtMoney } from '../logic/stats';
import { freqLabel, type Freq } from '../logic/recurrence';
import { SheetModal, IconBubble } from '../components/ui';
import type { Category, TxType } from '../types';

const CAT_EMOJIS = ['🏠', '🎮', '🛍️', '🍚', '🚕', '💊', '📱', '🎁', '💰', '💼'];

const WEEKDAYS = [
  { day: 1, label: '周一' }, { day: 2, label: '周二' }, { day: 3, label: '周三' },
  { day: 4, label: '周四' }, { day: 5, label: '周五' }, { day: 6, label: '周六' }, { day: 7, label: '周日' },
];

export function RecurrenceScreen({ onClose }: { onClose: () => void }) {
  const { palette, revision, bump } = useApp();
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState<null | {
    type: TxType; name: string; amount: string; catId: number | null; accId: number | null;
    freq: Freq; day: number;
  }>(null);

  const rules = useMemo(() => listRecurrences(), [revision]);
  const expenseCats = useMemo(() => {
    const tops = topCategories('expense');
    const other = tops.find((c) => c.name === '其他');
    return [...tops.filter((c) => c.name !== '其他'), ...(other ? subCategories(other.id) : [])];
  }, [revision]);
  const incomeCats = useMemo(() => topCategories('income'), [revision]);
  const accounts = useMemo(() => listAccounts(false), [revision]);

  function openForm() {
    setForm({
      type: 'expense', name: '', amount: '', catId: expenseCats[0]?.id ?? null,
      accId: accounts[0]?.id ?? null, freq: 'monthly', day: 1,
    });
    setSheet(true);
  }

  function saveForm() {
    if (!form) return;
    const amt = Number(form.amount.replace(/[^0-9.]/g, ''));
    if (!amt || amt <= 0 || !form.catId || !form.accId) return;
    addRecurrence({
      name: form.name.trim() || CAT_NAME_FALLBACK(form),
      type: form.type, amount: amt, categoryId: form.catId, accountId: form.accId,
      freq: form.freq, day: form.day, note: form.name.trim(),
      startDate: todayStr(),
    });
    bump();
    setSheet(false);
  }

  function del(id: number) {
    deleteRecurrence(id);
    bump();
  }

  function toggleActive(id: number, active: boolean) {
    setRecurrenceActive(id, active);
    bump();
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[st.topbar, { backgroundColor: palette.bg }]}>
        <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={{ color: palette.primary, fontSize: 14.5 }}>‹ 返回</Text></TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '800', color: palette.text }}>周期记账</Text>
        <TouchableOpacity onPress={openForm} hitSlop={10}><Text style={{ color: palette.primary, fontSize: 20, fontWeight: '700' }}>＋</Text></TouchableOpacity>
      </View>

      <Text style={[st.hint, { color: palette.faint }]}>固定收支（房租、工资、会员费）设置一次，App打开时自动按日期记入账单，不用每月手动重复记。</Text>

      {rules.length === 0 ? (
        <View style={st.empty}>
          <Text style={{ fontSize: 38 }}>🔁</Text>
          <Text style={{ color: palette.faint, fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
            还没有周期规则{'\n'}点右上角 ＋ 添加，比如"每月1日 房租 ¥3000"
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {rules.map((r) => {
            const nextDesc = r.active
              ? (r.lastGenerated && r.lastGenerated >= todayStr() ? '今天已入账' : `打开App自动入账 · ${freqLabel(r.freq, r.day)}`)
              : '已停用';
            return (
              <View key={r.id} style={[st.card, { backgroundColor: palette.card }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconBubble icon={(r.type === 'income' ? '💰' : '💸')} size={36} fontSize={17} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: palette.text }} numberOfLines={1}>
                      {r.name || '周期账单'}
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.faint, marginTop: 2 }}>
                      {freqLabel(r.freq, r.day)} · {r.type === 'income' ? '收入' : '支出'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: r.type === 'income' ? palette.income : palette.text, fontVariant: ['tabular-nums'] as never }}>
                    {r.type === 'income' ? '+' : '-'}¥{fmtMoney(r.amount)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
                  <Text style={{ fontSize: 11, color: palette.faint, flex: 1 }}>{nextDesc}</Text>
                  <TouchableOpacity style={[st.chip, { borderColor: palette.border }]} onPress={() => toggleActive(r.id, !r.active)}>
                    <Text style={{ fontSize: 11, color: r.active ? palette.faint : palette.primary }}>
                      {r.active ? '停用' : '启用'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.chip, { borderColor: palette.danger }]} onPress={() => del(r.id)}>
                    <Text style={{ fontSize: 11, color: palette.danger }}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* 新建规则弹层 */}
      <SheetModal visible={sheet} onClose={() => setSheet(false)} title="添加周期记账">
        <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
          {form && (
            <>
              <Text style={[st.fl, { color: palette.sub }]}>名称（显示在账单备注）</Text>
              <TextInput
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                placeholder="如：房租 / 工资 / 视频会员"
                placeholderTextColor={palette.faint}
                maxLength={12}
                style={[st.input, { backgroundColor: palette.keyFnBg, color: palette.text, borderColor: palette.border }]}
              />
              <Text style={[st.fl, { color: palette.sub }]}>类型与金额</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <View style={[st.seg, { backgroundColor: palette.keyFnBg }]}>
                  {(['expense', 'income'] as TxType[]).map((t) => (
                    <TouchableOpacity key={t} style={[st.segItem, form.type === t && { backgroundColor: palette.primary, borderRadius: 8 }]} onPress={() => setForm({ ...form, type: t, catId: t === 'expense' ? expenseCats[0]?.id ?? null : incomeCats[0]?.id ?? null })}>
                      <Text style={{ fontSize: 13, color: form.type === t ? palette.onAccent : palette.sub, fontWeight: form.type === t ? '700' : '400' }}>{t === 'expense' ? '支出' : '收入'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={form.amount}
                  onChangeText={(t) => setForm({ ...form, amount: t.replace(/[^0-9.]/g, '') })}
                  placeholder="金额"
                  placeholderTextColor={palette.faint}
                  keyboardType="decimal-pad"
                  style={[st.input, { flex: 1, marginBottom: 0, backgroundColor: palette.keyFnBg, color: palette.text, borderColor: palette.border }]}
                />
              </View>
              <Text style={[st.fl, { color: palette.sub }]}>分类</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(form.type === 'expense' ? expenseCats : incomeCats).map((c: Category) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[st.chip, form.catId === c.id && { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}
                      onPress={() => setForm({ ...form, catId: c.id })}
                    >
                      <Text style={{ fontSize: 12, color: form.catId === c.id ? palette.primary : palette.text }}>{c.icon} {c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={[st.fl, { color: palette.sub }]}>账户</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {accounts.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[st.chip, form.accId === a.id && { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}
                      onPress={() => setForm({ ...form, accId: a.id })}
                    >
                      <Text style={{ fontSize: 12, color: form.accId === a.id ? palette.primary : palette.text }}>{a.icon} {a.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={[st.fl, { color: palette.sub }]}>重复频率</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {([['monthly', '每月'], ['weekly', '每周']] as const).map(([f, label]) => (
                  <TouchableOpacity
                    key={f}
                    style={[st.chip, form.freq === f && { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}
                    onPress={() => setForm({ ...form, freq: f as Freq, day: f === 'monthly' ? 1 : 5 })}
                  >
                    <Text style={{ fontSize: 12.5, color: form.freq === f ? palette.primary : palette.text, fontWeight: form.freq === f ? '700' : '400' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {form.freq === 'monthly'
                    ? Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <TouchableOpacity key={d} onPress={() => setForm({ ...form, day: d })} style={[st.dayChip, form.day === d && { backgroundColor: palette.primary, borderColor: palette.primary }]}>
                        <Text style={{ fontSize: 11.5, color: form.day === d ? palette.onAccent : palette.text }}>{d}日</Text>
                      </TouchableOpacity>
                    ))
                    : WEEKDAYS.map((w) => (
                      <TouchableOpacity key={w.day} onPress={() => setForm({ ...form, day: w.day })} style={[st.dayChip, form.day === w.day && { backgroundColor: palette.primary, borderColor: palette.primary }]}>
                        <Text style={{ fontSize: 11.5, color: form.day === w.day ? palette.onAccent : palette.text }}>{w.label}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>
              <TouchableOpacity style={[st.primaryBtn, { backgroundColor: palette.primary }]} onPress={saveForm}>
                <Text style={{ color: palette.onAccent, fontWeight: '800', fontSize: 15 }}>保存规则</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SheetModal>
    </View>
  );
}

function CAT_NAME_FALLBACK(form: { type: TxType; catId: number | null }): string {
  return form.type === 'income' ? '周期收入' : '周期支出';
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const st = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12 },
  hint: { fontSize: 12, lineHeight: 19, paddingHorizontal: 20, marginBottom: 12 },
  card: { borderRadius: 18, marginHorizontal: 20, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(128,140,160,0.10)', elevation: 2 },
  empty: { alignItems: 'center', marginTop: 70 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  dayChip: { borderWidth: 1, borderColor: 'rgba(128,140,160,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  fl: { fontSize: 12, marginBottom: 6, marginTop: 2 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14.5, marginBottom: 8 },
  seg: { flexDirection: 'row', borderRadius: 10, padding: 3, flex: 1 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  primaryBtn: { alignItems: 'center', paddingVertical: 13, borderRadius: 14 },
});
