import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/client';
import { en, t } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { useGroup } from '@/core/providers/group';
import { theme } from '@/core/theme';
import { monthOf, shiftMonth, todayKey } from '@/features/meals/dates';
import { addComment, createExpense, deleteExpense, fetchExpenses, fetchSchedule, saveAssignment, updateExpense } from './api';
import type { BazarSchedule, Expense, ItemInput } from './schemas';

type Draft = { date: string; note: string; items: { name: string; amount: string }[] };

const emptyDraft = (): Draft => ({ date: todayKey(), note: '', items: [{ name: '', amount: '' }] });

const draftOf = (e: Expense): Draft => ({
  date: e.date.slice(0, 10),
  note: e.note,
  items: e.items.map((i) => ({ name: i.name, amount: String(i.amount) })),
});

function parseDraft(d: Draft): { date: string; note: string; items: ItemInput[] } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
  const items = d.items
    .filter((i) => i.name.trim() || i.amount.trim())
    .map((i) => ({ name: i.name.trim(), amount: Number(i.amount) }));
  if (items.length === 0 || items.some((i) => !i.name || !Number.isFinite(i.amount) || i.amount <= 0)) return null;
  return { date: d.date, note: d.note.trim(), items };
}

function ExpenseForm({ initial, busy, onSave, onCancel }: { initial: Draft; busy: boolean; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  const setItem = (index: number, patch: Partial<Draft['items'][number]>) =>
    setDraft({ ...draft, items: draft.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  return (
    <View style={styles.card}>
      <TextInput accessibilityLabel={en.bazar.dateLabel} placeholder={en.bazar.dateLabel} style={styles.input} value={draft.date} onChangeText={(date) => setDraft({ ...draft, date })} />
      <TextInput accessibilityLabel={en.bazar.noteLabel} placeholder={en.bazar.noteLabel} style={styles.input} value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} />
      {draft.items.map((it, i) => (
        <View key={i} style={styles.itemRow}>
          <TextInput accessibilityLabel={en.bazar.itemName} placeholder={en.bazar.itemName} style={[styles.input, styles.grow]} value={it.name} onChangeText={(name) => setItem(i, { name })} />
          <TextInput accessibilityLabel={en.bazar.itemAmount} placeholder={en.bazar.itemAmount} keyboardType="decimal-pad" style={[styles.input, styles.amount]} value={it.amount} onChangeText={(amount) => setItem(i, { amount })} />
          {draft.items.length > 1 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={en.bazar.removeItem} style={styles.small} onPress={() => setDraft({ ...draft, items: draft.items.filter((_, n) => n !== i) })}>
              <Text style={styles.buttonText}>−</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => setDraft({ ...draft, items: [...draft.items, { name: '', amount: '' }] })}>
        <Text style={styles.buttonText}>{en.bazar.addItem}</Text>
      </Pressable>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, styles.grow]} onPress={() => onSave(draft)}>
          <Text style={styles.primaryText}>{en.bazar.save}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button} onPress={onCancel}>
          <Text style={styles.buttonText}>{en.bazar.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ExpenseCard({
  expense,
  canEdit,
  busy,
  onEdit,
  onDelete,
  onComment,
}: {
  expense: Expense;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onComment: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{expense.date.slice(0, 10)}</Text>
        <Text style={styles.title}>{expense.amount}</Text>
      </View>
      {expense.payer ? <Text style={styles.muted}>{t(en.bazar.paidBy, { name: expense.payer.name })}</Text> : null}
      {expense.note ? <Text style={styles.text}>{expense.note}</Text> : null}
      {expense.items.map((i) => (
        <View key={i.id} style={styles.head}>
          <Text style={styles.text}>{i.name}</Text>
          <Text style={styles.text}>{i.amount}</Text>
        </View>
      ))}
      {canEdit ? (
        confirming ? (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.danger} onPress={onDelete}>
              <Text style={styles.primaryText}>{en.bazar.yes}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setConfirming(false)}>
              <Text style={styles.buttonText}>{en.bazar.cancel}</Text>
            </Pressable>
            <Text style={styles.muted}>{en.bazar.confirmRemove}</Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" style={styles.button} onPress={onEdit}>
              <Text style={styles.buttonText}>{en.bazar.edit}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setConfirming(true)}>
              <Text style={styles.buttonText}>{en.bazar.remove}</Text>
            </Pressable>
          </View>
        )
      ) : null}
      {expense.comments.length > 0 ? <Text style={styles.muted}>{en.bazar.comments}</Text> : null}
      {expense.comments.map((c) => (
        <Text key={c.id} style={styles.text}>
          {c.authorName}: {c.text}
        </Text>
      ))}
      <View style={styles.row}>
        <TextInput accessibilityLabel={en.bazar.commentLabel} placeholder={en.bazar.commentLabel} maxLength={500} style={[styles.input, styles.grow]} value={text} onChangeText={setText} />
        <Pressable
          accessibilityRole="button"
          disabled={busy || !text.trim()}
          style={[styles.button, !text.trim() && styles.disabled]}
          onPress={() => {
            onComment(text.trim());
            setText('');
          }}
        >
          <Text style={styles.buttonText}>{en.bazar.send}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DutyView({ groupId, month, onNotice }: { groupId: string; month: string; onNotice: (m: string | null) => void }) {
  const client = useQueryClient();
  const [picking, setPicking] = useState<number | null>(null);
  const query = useQuery({ queryKey: ['bazar-schedule', groupId, month], queryFn: () => fetchSchedule(groupId, month) });
  const assign = useMutation({
    mutationFn: ({ day, userId }: { day: number; userId: string | null }) => saveAssignment(groupId, month, day, userId),
    onSuccess: (data: BazarSchedule) => {
      client.setQueryData(['bazar-schedule', groupId, month], data);
      setPicking(null);
      onNotice(null);
    },
    onError: (e) => onNotice(e instanceof ApiError ? e.message : en.bazar.actionFailed),
  });
  const data = query.data;
  if (query.isLoading) return <Text style={styles.muted}>{en.common.loading}</Text>;
  if (query.isError || !data) return <Text style={styles.error}>{en.bazar.dutyLoadFailed}</Text>;
  const canEdit = data.canManage && data.editable;
  return (
    <View style={styles.gap}>
      {data.lockedReason ? <Text style={styles.muted}>{en.bazar.dutyLocked}</Text> : null}
      {data.days.map((d) => (
        <View key={d.day} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{t(en.bazar.dutyDay, { day: String(d.day) })}</Text>
            <Text style={d.userId === data.currentUserId ? styles.title : styles.text}>
              {d.userName ? (d.userId === data.currentUserId ? t(en.bazar.dutyYou, { name: d.userName }) : d.userName) : en.bazar.dutyNobody}
            </Text>
          </View>
          {canEdit ? (
            picking === d.day ? (
              <View style={styles.gap}>
                <Text style={styles.muted}>{t(en.bazar.dutyChoose, { day: String(d.day) })}</Text>
                <View style={styles.wrap}>
                  {data.members.map((m) => (
                    <Pressable key={m.id} accessibilityRole="button" disabled={assign.isPending} style={styles.button} onPress={() => assign.mutate({ day: d.day, userId: m.id })}>
                      <Text style={styles.buttonText}>{m.name}</Text>
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" disabled={assign.isPending} style={styles.button} onPress={() => assign.mutate({ day: d.day, userId: null })}>
                    <Text style={styles.buttonText}>{en.bazar.dutyClear}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => setPicking(d.day)}>
                <Text style={styles.buttonText}>{en.bazar.edit}</Text>
              </Pressable>
            )
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function BazarScreen() {
  const { active } = useGroup();
  const { user } = useAuth();
  const groupId = active?.id ?? '';
  const [tab, setTab] = useState<'expenses' | 'duty'>('expenses');
  const [month, setMonth] = useState(monthOf(todayKey()));
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: string | null; draft: Draft } | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['bazar-expenses', groupId, month], queryFn: () => fetchExpenses(groupId, month), enabled: !!groupId });
  const refresh = () => client.invalidateQueries({ queryKey: ['bazar-expenses', groupId] });
  const fail = (e: unknown) => setNotice(e instanceof ApiError ? e.message : en.bazar.actionFailed);

  const save = useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: { date: string; items: ItemInput[]; note: string } }) =>
      id ? updateExpense(id, body) : createExpense(groupId, body),
    onSuccess: () => {
      setForm(null);
      setNotice(en.bazar.saved);
      return refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      setNotice(en.bazar.deleted);
      return refresh();
    },
    onError: fail,
  });
  const comment = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => addComment(id, text),
    onSuccess: () => {
      setNotice(null);
      return refresh();
    },
    onError: fail,
  });

  if (!active) return <Text style={styles.empty}>{en.group.none}</Text>;

  const submit = (id: string | null, draft: Draft) => {
    const body = parseDraft(draft);
    if (!body) {
      setNotice(en.bazar.invalidForm);
      return;
    }
    setNotice(null);
    save.mutate({ id, body });
  };

  const data = query.data;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      <View style={styles.row}>
        {(['expenses', 'duty'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: tab === k }} style={[styles.button, styles.grow, tab === k && styles.on]} onPress={() => setTab(k)}>
            <Text style={tab === k ? styles.primaryText : styles.buttonText}>{k === 'expenses' ? en.bazar.expensesTab : en.bazar.dutyTab}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={en.bazar.prevMonth} style={styles.small} onPress={() => setMonth(shiftMonth(month, -1))}>
          <Text style={styles.buttonText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{month}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={en.bazar.nextMonth} style={styles.small} onPress={() => setMonth(shiftMonth(month, 1))}>
          <Text style={styles.buttonText}>›</Text>
        </Pressable>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {tab === 'duty' ? <DutyView groupId={groupId} month={month} onNotice={setNotice} /> : null}

      {tab === 'expenses' ? (
        <>
          {query.isLoading ? <Text style={styles.muted}>{en.common.loading}</Text> : null}
          {query.isError ? (
            <View>
              <Text style={styles.error}>{en.bazar.loadFailed}</Text>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => void query.refetch()}>
                <Text style={styles.buttonText}>{en.common.retry}</Text>
              </Pressable>
            </View>
          ) : null}
          {form && form.id === null ? (
            <ExpenseForm initial={form.draft} busy={save.isPending} onSave={(d) => submit(null, d)} onCancel={() => setForm(null)} />
          ) : (
            <Pressable accessibilityRole="button" style={styles.primary} onPress={() => setForm({ id: null, draft: emptyDraft() })}>
              <Text style={styles.primaryText}>{en.bazar.add}</Text>
            </Pressable>
          )}
          {data && data.expenses.length === 0 ? <Text style={styles.muted}>{en.bazar.noExpenses}</Text> : null}
          {data?.expenses.map((e) =>
            form && form.id === e.id ? (
              <ExpenseForm key={e.id} initial={form.draft} busy={save.isPending} onSave={(d) => submit(e.id, d)} onCancel={() => setForm(null)} />
            ) : (
              <ExpenseCard
                key={e.id}
                expense={e}
                canEdit={isAdmin || e.payer?.id === data.currentUserId}
                busy={remove.isPending || comment.isPending}
                onEdit={() => setForm({ id: e.id, draft: draftOf(e) })}
                onDelete={() => remove.mutate(e.id)}
                onComment={(text) => comment.mutate({ id: e.id, text })}
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
  gap: { gap: theme.spacing.sm },
  muted: { color: theme.colors.muted },
  text: { color: theme.colors.text },
  error: { color: theme.colors.error, marginBottom: theme.spacing.sm },
  notice: { color: theme.colors.text, backgroundColor: '#eff6ff', padding: theme.spacing.sm, borderRadius: theme.radius },
  card: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, gap: theme.spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '600', color: theme.colors.text },
  row: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  itemRow: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
  amount: { width: 90 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.sm, color: theme.colors.text },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 8, paddingHorizontal: theme.spacing.md, alignItems: 'center' },
  small: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: theme.colors.text },
  on: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  primary: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing.sm, alignItems: 'center' },
  danger: { backgroundColor: theme.colors.error, borderRadius: theme.radius, paddingVertical: 8, paddingHorizontal: theme.spacing.md },
  primaryText: { color: theme.colors.primaryText, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
