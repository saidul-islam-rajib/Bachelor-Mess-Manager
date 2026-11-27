import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/client';
import { en, t } from '@/core/i18n/en';
import { useGroup } from '@/core/providers/group';
import { theme } from '@/core/theme';
import { monthOf, shiftMonth, todayKey } from '@/features/meals/dates';
import { createBill, deleteBill, fetchBills, reverseCollection, settleShare, updateBill, type BillInput } from './api';
import type { Bill, BillsMonth } from './schemas';

type Draft = { type: string; amount: string; date: string; note: string };

const parseDraft = (d: Draft): BillInput | null => {
  const amount = Number(d.amount);
  if (!d.type || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
  return { type: d.type, amount, date: d.date, note: d.note.trim() };
};

function BillForm({ data, initial, busy, onSave, onCancel }: { data: BillsMonth; initial: Draft; busy: boolean; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  return (
    <View style={styles.card}>
      <View style={styles.wrap}>
        {data.categories.map((c) => (
          <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: draft.type === c }} style={[styles.button, draft.type === c && styles.on]} onPress={() => setDraft({ ...draft, type: c })}>
            <Text style={draft.type === c ? styles.primaryText : styles.buttonText}>{data.categoryLabels[c] ?? c}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput accessibilityLabel={en.bills.amountLabel} placeholder={en.bills.amountLabel} keyboardType="decimal-pad" style={styles.input} value={draft.amount} onChangeText={(amount) => setDraft({ ...draft, amount })} />
      <TextInput accessibilityLabel={en.bills.dateLabel} placeholder={en.bills.dateLabel} style={styles.input} value={draft.date} onChangeText={(date) => setDraft({ ...draft, date })} />
      <TextInput accessibilityLabel={en.bills.noteLabel} placeholder={en.bills.noteLabel} style={styles.input} value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} />
      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, styles.grow]} onPress={() => onSave(draft)}>
          <Text style={styles.primaryText}>{en.bills.save}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button} onPress={onCancel}>
          <Text style={styles.buttonText}>{en.bills.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BillCard({
  bill,
  data,
  busy,
  onEdit,
  onDelete,
  onSettle,
  onReverse,
}: {
  bill: Bill;
  data: BillsMonth;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSettle: (userId: string) => void;
  onReverse: (collectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mine = bill.shares.find((s) => s.userId === data.currentUserId);
  const label = data.categoryLabels[bill.type] ?? bill.type;
  const canPay = (userId: string) => data.canManage || (data.canRecordOwn && userId === data.currentUserId);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.title}>{bill.amount}</Text>
      </View>
      <Text style={styles.muted}>{bill.date}</Text>
      {bill.payer ? <Text style={styles.muted}>{t(en.bills.paidBy, { name: bill.payer.name })}</Text> : null}
      {bill.note ? <Text style={styles.text}>{bill.note}</Text> : null}
      {mine && mine.isShare ? (
        <Text style={styles.text}>{t(en.bills.yourShare, { share: String(mine.amount), paid: String(mine.paid), due: String(mine.outstanding) })}</Text>
      ) : null}
      <Text style={styles.muted}>{bill.isFullyCollected ? en.bills.fullyCollected : t(en.bills.unpaid, { count: String(bill.unpaidMemberCount), amount: String(bill.uncollected) })}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => setOpen(!open)}>
        <Text style={styles.buttonText}>{open ? en.bills.hideShares : en.bills.showShares}</Text>
      </Pressable>
      {open
        ? bill.shares.map((s) => (
            <View key={s.userId} style={styles.share}>
              <View style={styles.head}>
                <Text style={styles.title}>{s.userName}</Text>
                <Text style={styles.text}>{t(en.bills.shareLine, { share: String(s.amount), paid: String(s.paid) })}</Text>
              </View>
              {s.outstanding > 0 && canPay(s.userId) ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t(en.bills.markPaidFor, { name: s.userName })} disabled={busy} style={styles.button} onPress={() => onSettle(s.userId)}>
                  <Text style={styles.buttonText}>{s.userId === data.currentUserId ? en.bills.markMinePaid : en.bills.markPaid}</Text>
                </Pressable>
              ) : null}
              {s.collections.map((c) => (
                <View key={c.id} style={styles.head}>
                  <Text style={c.isReversal || c.isReversed ? styles.muted : styles.text}>
                    {c.date} · {c.amount}
                    {c.isReversed ? ` · ${en.bills.reversed}` : ''}
                  </Text>
                  {data.canManage && !c.isReversal && !c.isReversed && !c.isLinked ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t(en.bills.reverseFor, { name: s.userName })} disabled={busy} style={styles.small} onPress={() => onReverse(c.id)}>
                      <Text style={styles.buttonText}>{en.bills.reverse}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ))
        : null}
      {data.canManage ? (
        confirming ? (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.danger} onPress={onDelete}>
              <Text style={styles.primaryText}>{en.bills.yes}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setConfirming(false)}>
              <Text style={styles.buttonText}>{en.bills.cancel}</Text>
            </Pressable>
            <Text style={styles.muted}>{en.bills.confirmRemove}</Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" style={styles.button} onPress={onEdit}>
              <Text style={styles.buttonText}>{en.bills.edit}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setConfirming(true)}>
              <Text style={styles.buttonText}>{en.bills.remove}</Text>
            </Pressable>
          </View>
        )
      ) : null}
    </View>
  );
}

export function BillsScreen() {
  const { active } = useGroup();
  const groupId = active?.id ?? '';
  const [month, setMonth] = useState(monthOf(todayKey()));
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: string | null; draft: Draft } | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['bills', groupId, month], queryFn: () => fetchBills(groupId, month), enabled: !!groupId });
  const refresh = () => client.invalidateQueries({ queryKey: ['bills', groupId] });
  const fail = (e: unknown) => setNotice(e instanceof ApiError ? e.message : en.bills.actionFailed);
  const done = (message: string) => () => {
    setNotice(message);
    return refresh();
  };

  const save = useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: BillInput }) => (id ? updateBill(id, body) : createBill(groupId, body)),
    onSuccess: () => {
      setForm(null);
      setNotice(en.bills.saved);
      return refresh();
    },
    onError: fail,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteBill(id), onSuccess: done(en.bills.deleted), onError: fail });
  const settle = useMutation({
    mutationFn: ({ billId, userId }: { billId: string; userId: string }) => settleShare(billId, userId),
    onSuccess: done(en.bills.paymentSaved),
    onError: fail,
  });
  const reverse = useMutation({
    mutationFn: ({ billId, collectionId }: { billId: string; collectionId: string }) => reverseCollection(billId, collectionId),
    onSuccess: done(en.bills.reversedDone),
    onError: fail,
  });

  if (!active) return <Text style={styles.empty}>{en.group.none}</Text>;

  const data = query.data;
  const busy = remove.isPending || settle.isPending || reverse.isPending;
  const submit = (id: string | null, draft: Draft) => {
    const body = parseDraft(draft);
    if (!body) {
      setNotice(en.bills.invalidForm);
      return;
    }
    setNotice(null);
    save.mutate({ id, body });
  };
  const blank = (): Draft => ({ type: data?.categories[0] ?? '', amount: '', date: todayKey(), note: '' });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={en.bills.prevMonth} style={styles.small} onPress={() => setMonth(shiftMonth(month, -1))}>
          <Text style={styles.buttonText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{month}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={en.bills.nextMonth} style={styles.small} onPress={() => setMonth(shiftMonth(month, 1))}>
          <Text style={styles.buttonText}>›</Text>
        </Pressable>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {query.isLoading ? <Text style={styles.muted}>{en.common.loading}</Text> : null}
      {query.isError ? (
        <View>
          <Text style={styles.error}>{en.bills.loadFailed}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void query.refetch()}>
            <Text style={styles.buttonText}>{en.common.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {data ? (
        <>
          <View style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.text}>{en.bills.total}</Text>
              <Text style={styles.title}>{data.totals.total}</Text>
            </View>
            <View style={styles.head}>
              <Text style={styles.text}>{en.bills.collected}</Text>
              <Text style={styles.title}>{data.totals.collected}</Text>
            </View>
            <View style={styles.head}>
              <Text style={styles.text}>{en.bills.outstanding}</Text>
              <Text style={styles.title}>{data.totals.uncollected}</Text>
            </View>
          </View>
          {data.canManage ? (
            form && form.id === null ? (
              <BillForm data={data} initial={form.draft} busy={save.isPending} onSave={(d) => submit(null, d)} onCancel={() => setForm(null)} />
            ) : (
              <Pressable accessibilityRole="button" style={styles.primary} onPress={() => setForm({ id: null, draft: blank() })}>
                <Text style={styles.primaryText}>{en.bills.add}</Text>
              </Pressable>
            )
          ) : null}
          {data.bills.length === 0 ? <Text style={styles.muted}>{en.bills.none}</Text> : null}
          {data.bills.map((b) =>
            form && form.id === b.id ? (
              <BillForm key={b.id} data={data} initial={form.draft} busy={save.isPending} onSave={(d) => submit(b.id, d)} onCancel={() => setForm(null)} />
            ) : (
              <BillCard
                key={b.id}
                bill={b}
                data={data}
                busy={busy}
                onEdit={() => setForm({ id: b.id, draft: { type: b.type, amount: String(b.amount), date: b.date, note: b.note } })}
                onDelete={() => remove.mutate(b.id)}
                onSettle={(userId) => settle.mutate({ billId: b.id, userId })}
                onReverse={(collectionId) => reverse.mutate({ billId: b.id, collectionId })}
              />
            ),
          )}
        </>
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
  share: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
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
  danger: { backgroundColor: theme.colors.error, borderRadius: theme.radius, paddingVertical: 8, paddingHorizontal: theme.spacing.md },
  primaryText: { color: theme.colors.primaryText, fontWeight: '600' },
});
