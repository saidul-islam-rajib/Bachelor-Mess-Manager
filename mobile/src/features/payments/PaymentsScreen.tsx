import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/client';
import { en, t } from '@/core/i18n/en';
import { useGroup } from '@/core/providers/group';
import { theme } from '@/core/theme';
import { monthOf, shiftMonth, todayKey } from '@/features/meals/dates';
import { fetchAdvances, fetchPayments, recordAdvance, recordPayment, reverseAdvance, reversePayment, updatePayment } from './api';
import type { PaymentRow } from './schemas';

type Form = { kind: 'payment' | 'advance'; userId: string; amount: string; date: string };
type Edit = { id: string; amount: string; date: string };

export function PaymentsScreen() {
  const { active } = useGroup();
  const groupId = active?.id ?? '';
  const [month, setMonth] = useState(monthOf(todayKey()));
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const client = useQueryClient();
  const payments = useQuery({ queryKey: ['payments', groupId, month], queryFn: () => fetchPayments(groupId, month), enabled: !!groupId });
  const advances = useQuery({ queryKey: ['advances', groupId], queryFn: () => fetchAdvances(groupId), enabled: !!groupId });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['payments', groupId] }), client.invalidateQueries({ queryKey: ['advances', groupId] })]);
  const fail = (e: unknown) => setNotice(e instanceof ApiError ? e.message : en.payments.actionFailed);
  const done = (message: string) => () => {
    setNotice(message);
    setForm(null);
    setEdit(null);
    return refresh();
  };

  const pay = useMutation({ mutationFn: (b: { userId: string; amount: number; date: string }) => recordPayment(groupId, b), onSuccess: done(en.payments.paymentSaved), onError: fail });
  const advance = useMutation({ mutationFn: (b: { userId: string; amount: number }) => recordAdvance(groupId, b), onSuccess: done(en.payments.advanceSaved), onError: fail });
  const reverse = useMutation({ mutationFn: (id: string) => reversePayment(id), onSuccess: done(en.payments.reversedDone), onError: fail });
  const reverseAdv = useMutation({ mutationFn: (id: string) => reverseAdvance(groupId, id), onSuccess: done(en.payments.reversedDone), onError: fail });
  const patch = useMutation({ mutationFn: (b: { id: string; amount: number; date: string }) => updatePayment(b.id, { amount: b.amount, date: b.date }), onSuccess: done(en.payments.updated), onError: fail });

  if (!active) return <Text style={styles.empty}>{en.group.none}</Text>;

  const data = payments.data;
  const adv = advances.data;
  const busy = pay.isPending || advance.isPending || reverse.isPending || reverseAdv.isPending || patch.isPending;
  const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const submitForm = () => {
    if (!form) return;
    const amount = Number(form.amount);
    if (!form.userId || !Number.isFinite(amount) || amount <= 0 || (form.kind === 'payment' && !validDate(form.date))) {
      setNotice(en.payments.invalidForm);
      return;
    }
    setNotice(null);
    if (form.kind === 'payment') pay.mutate({ userId: form.userId, amount, date: form.date });
    else advance.mutate({ userId: form.userId, amount });
  };
  const submitEdit = () => {
    if (!edit) return;
    const amount = Number(edit.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !validDate(edit.date)) {
      setNotice(en.payments.invalidForm);
      return;
    }
    setNotice(null);
    patch.mutate({ id: edit.id, amount, date: edit.date });
  };
  const mine = data?.members.find((m) => m.id === data.currentUserId);
  const myAdvance = adv?.members.find((m) => m.id === adv.currentUserId);
  const open = (kind: Form['kind']) => setForm({ kind, userId: data?.members[0]?.id ?? '', amount: '', date: todayKey() });

  const row = (p: PaymentRow) => (
    <View key={p.id} style={styles.line}>
      <View style={styles.head}>
        <Text style={p.isReversal || p.isReversed ? styles.muted : styles.text}>
          {p.date} · {p.userName} · {p.amount}
          {p.isReversed ? ` · ${en.payments.reversed}` : ''}
        </Text>
      </View>
      {data?.canManage && !p.isReversal && !p.isReversed && !p.isLinked && !p.billId ? (
        edit && edit.id === p.id ? (
          <View style={styles.gap}>
            <TextInput accessibilityLabel={en.payments.amountLabel} keyboardType="decimal-pad" style={styles.input} value={edit.amount} onChangeText={(amount) => setEdit({ ...edit, amount })} />
            <TextInput accessibilityLabel={en.payments.dateLabel} style={styles.input} value={edit.date} onChangeText={(date) => setEdit({ ...edit, date })} />
            <View style={styles.row}>
              <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, styles.grow]} onPress={submitEdit}>
                <Text style={styles.primaryText}>{en.payments.save}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => setEdit(null)}>
                <Text style={styles.buttonText}>{en.payments.cancel}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={t(en.payments.editFor, { name: p.userName })} style={styles.button} onPress={() => setEdit({ id: p.id, amount: String(p.amount), date: p.date })}>
              <Text style={styles.buttonText}>{en.payments.edit}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t(en.payments.reverseFor, { name: p.userName })} disabled={busy} style={styles.button} onPress={() => reverse.mutate(p.id)}>
              <Text style={styles.buttonText}>{en.payments.reverse}</Text>
            </Pressable>
          </View>
        )
      ) : null}
    </View>
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={payments.isRefetching} onRefresh={() => void Promise.all([payments.refetch(), advances.refetch()])} />}
    >
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={en.payments.prevMonth} style={styles.small} onPress={() => setMonth(shiftMonth(month, -1))}>
          <Text style={styles.buttonText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{month}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={en.payments.nextMonth} style={styles.small} onPress={() => setMonth(shiftMonth(month, 1))}>
          <Text style={styles.buttonText}>›</Text>
        </Pressable>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {payments.isLoading ? <Text style={styles.muted}>{en.common.loading}</Text> : null}
      {payments.isError ? (
        <View>
          <Text style={styles.error}>{en.payments.loadFailed}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void payments.refetch()}>
            <Text style={styles.buttonText}>{en.common.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {data ? (
        <>
          {data.closing ? <Text style={styles.muted}>{t(en.payments.closedThrough, { date: data.closing.closedThrough })}</Text> : null}
          <View style={styles.card}>
            <Text style={styles.title}>{en.payments.mine}</Text>
            {mine ? (
              <>
                <View style={styles.head}>
                  <Text style={styles.text}>{en.payments.cost}</Text>
                  <Text style={styles.title}>{mine.cost}</Text>
                </View>
                <View style={styles.head}>
                  <Text style={styles.text}>{en.payments.paid}</Text>
                  <Text style={styles.title}>{mine.collected}</Text>
                </View>
                <View style={styles.head}>
                  <Text style={styles.text}>{mine.due < 0 ? en.payments.refund : en.payments.due}</Text>
                  <Text style={styles.title}>{Math.abs(mine.due)}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.muted}>{en.payments.notMember}</Text>
            )}
            {myAdvance ? (
              <View style={styles.head}>
                <Text style={styles.text}>{en.payments.advanceBalance}</Text>
                <Text style={styles.title}>{myAdvance.balance}</Text>
              </View>
            ) : null}
          </View>
          {data.canManage ? (
            form ? (
              <View style={styles.card}>
                <View style={styles.wrap}>
                  {data.members.map((m) => (
                    <Pressable key={m.id} accessibilityRole="button" accessibilityState={{ selected: form.userId === m.id }} style={[styles.button, form.userId === m.id && styles.on]} onPress={() => setForm({ ...form, userId: m.id })}>
                      <Text style={form.userId === m.id ? styles.primaryText : styles.buttonText}>{m.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput accessibilityLabel={en.payments.amountLabel} placeholder={en.payments.amountLabel} keyboardType="decimal-pad" style={styles.input} value={form.amount} onChangeText={(amount) => setForm({ ...form, amount })} />
                {form.kind === 'payment' ? (
                  <TextInput accessibilityLabel={en.payments.dateLabel} placeholder={en.payments.dateLabel} style={styles.input} value={form.date} onChangeText={(date) => setForm({ ...form, date })} />
                ) : null}
                <View style={styles.row}>
                  <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, styles.grow]} onPress={submitForm}>
                    <Text style={styles.primaryText}>{en.payments.save}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.button} onPress={() => setForm(null)}>
                    <Text style={styles.buttonText}>{en.payments.cancel}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Pressable accessibilityRole="button" style={[styles.primary, styles.grow]} onPress={() => open('payment')}>
                  <Text style={styles.primaryText}>{en.payments.recordPayment}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={[styles.button, styles.grow]} onPress={() => open('advance')}>
                  <Text style={styles.buttonText}>{en.payments.recordAdvance}</Text>
                </Pressable>
              </View>
            )
          ) : null}
          <View style={styles.card}>
            <Text style={styles.title}>{en.payments.dues}</Text>
            {data.members.map((m) => (
              <View key={m.id} style={styles.head}>
                <Text style={styles.text}>{m.name}</Text>
                <Text style={m.due < 0 ? styles.muted : styles.title}>{m.due < 0 ? t(en.payments.owedBack, { amount: String(Math.abs(m.due)) }) : m.due}</Text>
              </View>
            ))}
            <View style={[styles.head, styles.line]}>
              <Text style={styles.text}>{en.payments.outstanding}</Text>
              <Text style={styles.title}>{data.totals.outstanding}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>{en.payments.history}</Text>
            {data.payments.length === 0 ? <Text style={styles.muted}>{en.payments.none}</Text> : data.payments.map(row)}
          </View>
        </>
      ) : null}
      {adv ? (
        <View style={styles.card}>
          <Text style={styles.title}>{en.payments.advances}</Text>
          {adv.members.map((m) => (
            <View key={m.id} style={styles.head}>
              <Text style={styles.text}>{m.name}</Text>
              <Text style={styles.title}>{m.balance}</Text>
            </View>
          ))}
          {adv.history.length === 0 ? <Text style={styles.muted}>{en.payments.noAdvances}</Text> : null}
          {adv.history.map((a) => (
            <View key={a.id} style={[styles.head, styles.line]}>
              <Text style={a.reversalOfId || a.isReversed ? styles.muted : styles.text}>
                {a.createdAt.slice(0, 10)} · {a.userName} · {a.amount}
                {a.isReversed ? ` · ${en.payments.reversed}` : ''}
              </Text>
              {adv.canManage && !a.reversalOfId && !a.isReversed && !a.expenseId ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t(en.payments.reverseAdvanceFor, { name: a.userName })} disabled={busy} style={styles.small} onPress={() => reverseAdv.mutate(a.id)}>
                  <Text style={styles.buttonText}>{en.payments.reverse}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  empty: { padding: theme.spacing.lg, color: theme.colors.muted },
  muted: { color: theme.colors.muted },
  text: { color: theme.colors.text },
  error: { color: theme.colors.error, marginBottom: theme.spacing.sm },
  notice: { color: theme.colors.text, backgroundColor: '#eff6ff', padding: theme.spacing.sm, borderRadius: theme.radius },
  card: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, gap: theme.spacing.sm },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
  gap: { gap: theme.spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  title: { fontWeight: '600', color: theme.colors.text },
  row: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  grow: { flex: 1 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.sm, color: theme.colors.text },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 8, paddingHorizontal: theme.spacing.md, alignItems: 'center' },
  small: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, minWidth: 36, height: 36, paddingHorizontal: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: theme.colors.text },
  on: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  primary: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing.sm, alignItems: 'center' },
  primaryText: { color: theme.colors.primaryText, fontWeight: '600' },
});
