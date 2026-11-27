import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/client';
import { en, t } from '@/core/i18n/en';
import { useGroup } from '@/core/providers/group';
import { theme } from '@/core/theme';
import { closeEditWindow, decideChange, fetchMeals, openEditWindow, saveMeals, withdrawChange } from './api';
import { daysOfMonth, formatCountdown, monthOf, shiftMonth, todayKey } from './dates';
import type { EditWindow, MealCounts, MealChangeRequest } from './schemas';

const ZERO: MealCounts = { breakfast: 0, lunch: 0, dinner: 0 };
const KINDS = ['breakfast', 'lunch', 'dinner'] as const;

const same = (a: MealCounts, b: MealCounts) => KINDS.every((k) => a[k] === b[k]);

function Countdown({ window, onExpired }: { window: EditWindow; onExpired: () => void }) {
  const expiresAt = window.expiresAt ? new Date(window.expiresAt).getTime() : null;
  const [left, setLeft] = useState(() => (expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))));

  useEffect(() => {
    if (expiresAt === null) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setLeft(next);
      if (next === 0) onExpired();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  if (window.unlimited || expiresAt === null) return <Text style={styles.muted}>{en.meals.windowUnlimited}</Text>;
  return <Text style={styles.muted}>{t(en.meals.windowLeft, { time: formatCountdown(left) })}</Text>;
}

function Stepper({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.kind}>{label}</Text>
      <View style={styles.stepRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(en.meals.decrease, { kind: label })}
          disabled={disabled || value <= 0}
          style={[styles.step, (disabled || value <= 0) && styles.disabled]}
          onPress={() => onChange(value - 1)}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.count}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(en.meals.increase, { kind: label })}
          disabled={disabled || value >= 9}
          style={[styles.step, (disabled || value >= 9) && styles.disabled]}
          onPress={() => onChange(value + 1)}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DayRow({
  date,
  saved,
  locked,
  today,
  saving,
  onSave,
}: {
  date: string;
  saved: MealCounts;
  locked: boolean;
  today: boolean;
  saving: boolean;
  onSave: (date: string, counts: MealCounts) => void;
}) {
  const [edited, setDraft] = useState<MealCounts | null>(null);
  const draft = edited ?? saved;
  const dirty = !same(draft, saved);
  const labels = en.meals.kinds;

  return (
    <View style={[styles.day, today && styles.today]}>
      <View style={styles.dayHead}>
        <Text style={styles.date}>{today ? t(en.meals.todayLabel, { date }) : date}</Text>
        {locked ? <Text style={styles.muted}>{en.meals.locked}</Text> : null}
      </View>
      <View style={styles.steppers}>
        {KINDS.map((k) => (
          <Stepper key={k} label={labels[k]} value={draft[k]} disabled={locked || saving} onChange={(v) => setDraft({ ...draft, [k]: v })} />
        ))}
      </View>
      {dirty && !locked ? (
        <Pressable accessibilityRole="button" disabled={saving} style={styles.save} onPress={() => onSave(date, draft)}>
          <Text style={styles.saveText}>{saving ? en.meals.saving : en.meals.save}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PendingRow({
  request,
  busy,
  review,
  onWithdraw,
  onDecide,
}: {
  request: MealChangeRequest;
  busy: boolean;
  review: boolean;
  onWithdraw: (id: string) => void;
  onDecide: (id: string, status: 'APPROVED' | 'REJECTED') => void;
}) {
  return (
    <View style={styles.pending}>
      <View style={styles.pendingText}>
        <Text style={styles.date}>{review ? t(en.meals.requestLine, { name: request.userName ?? '', date: request.date }) : request.date}</Text>
        <Text style={styles.muted}>{request.summary}</Text>
      </View>
      {review ? (
        <View style={styles.decide}>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.withdraw} onPress={() => onDecide(request.id, 'APPROVED')}>
            <Text style={styles.buttonText}>{en.meals.approve}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.withdraw} onPress={() => onDecide(request.id, 'REJECTED')}>
            <Text style={styles.buttonText}>{en.meals.reject}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" disabled={busy} style={styles.withdraw} onPress={() => onWithdraw(request.id)}>
          <Text style={styles.buttonText}>{en.meals.withdraw}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function MealsScreen() {
  const { active } = useGroup();
  const groupId = active?.id ?? '';
  const today = todayKey();
  const [month, setMonth] = useState(monthOf(today));
  const [notice, setNotice] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const client = useQueryClient();
  const key = useMemo(() => ['meals', groupId, month], [groupId, month]);

  const query = useQuery({ queryKey: key, queryFn: () => fetchMeals(groupId, month), enabled: !!groupId });
  const refresh = () => client.invalidateQueries({ queryKey: ['meals', groupId] });

  const fail = (e: unknown) => setNotice(e instanceof ApiError ? e.message : en.meals.actionFailed);

  const save = useMutation({
    mutationFn: ({ date, counts }: { date: string; counts: MealCounts }) =>
      saveMeals(groupId, date, counts, data && target !== data.currentUserId ? { userId: target } : {}),
    onMutate: ({ date }) => {
      setSavingDate(date);
      setNotice(null);
    },
    onSuccess: (res) => {
      setNotice(res.pending ? en.meals.requestSent : res.unchanged ? en.meals.unchanged : en.meals.saved);
      return refresh();
    },
    onError: fail,
    onSettled: () => setSavingDate(null),
  });

  const toggleWindow = useMutation({
    mutationFn: (open: boolean) => (open ? openEditWindow(groupId) : closeEditWindow(groupId)),
    onSuccess: () => {
      setNotice(null);
      return refresh();
    },
    onError: fail,
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawChange(id),
    onSuccess: () => {
      setNotice(en.meals.withdrawn);
      return refresh();
    },
    onError: fail,
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => decideChange(id, status),
    onSuccess: (res) => {
      setNotice(res.request.status === 'APPROVED' ? en.meals.approved : en.meals.rejected);
      return refresh();
    },
    onError: fail,
  });

  const data = query.data;
  const target = data?.canManage ? (picked ?? data.currentUserId) : (data?.currentUserId ?? '');
  const entries = useMemo(() => {
    const map = new Map<string, MealCounts>();
    for (const e of data?.entries ?? []) {
      if (e.userId === target) map.set(e.date, { breakfast: e.breakfast, lunch: e.lunch, dinner: e.dinner });
    }
    return map;
  }, [data, target]);
  const open = (data?.pendingChanges ?? []).filter((r) => r.pending);
  const mine = data?.canManage ? open : open.filter((r) => r.userId === data?.currentUserId);
  const windowOpen = data?.editWindow.open ?? false;
  const closedGroup = !!data && data.groupStatus !== 'ACTIVE';

  if (!active) return <Text style={styles.empty}>{en.group.none}</Text>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      <View style={styles.monthBar}>
        <Pressable accessibilityRole="button" accessibilityLabel={en.meals.prevMonth} style={styles.step} onPress={() => setMonth(shiftMonth(month, -1))}>
          <Text style={styles.stepText}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{month}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={en.meals.nextMonth} style={styles.step} onPress={() => setMonth(shiftMonth(month, 1))}>
          <Text style={styles.stepText}>›</Text>
        </Pressable>
      </View>

      {query.isLoading ? <Text style={styles.muted}>{en.common.loading}</Text> : null}
      {query.isError ? (
        <View>
          <Text style={styles.error}>{en.meals.loadFailed}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void query.refetch()}>
            <Text style={styles.buttonText}>{en.common.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {data ? (
        <>
          {closedGroup ? <Text style={styles.muted}>{en.meals.groupClosed}</Text> : null}

          {!closedGroup && !data.canManage ? (
            <View style={styles.window}>
              {windowOpen ? (
                <>
                  <Countdown window={data.editWindow} onExpired={() => void refresh()} />
                  <Pressable accessibilityRole="button" disabled={toggleWindow.isPending} style={styles.button} onPress={() => toggleWindow.mutate(false)}>
                    <Text style={styles.buttonText}>{en.meals.closeWindow}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable accessibilityRole="button" disabled={toggleWindow.isPending} style={styles.button} onPress={() => toggleWindow.mutate(true)}>
                  <Text style={styles.buttonText}>{en.meals.openWindow}</Text>
                </Pressable>
              )}
              <Text style={styles.muted}>{data.editWindow.requiresApproval ? en.meals.needsApproval : en.meals.noApproval}</Text>
            </View>
          ) : null}

          {data.canManage && !closedGroup ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{en.meals.editingFor}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {data.members.map((m) => (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: m.id === target }}
                    style={[styles.chip, m.id === target && styles.chipOn]}
                    onPress={() => setPicked(m.id)}
                  >
                    <Text style={m.id === target ? styles.saveText : styles.buttonText}>{m.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {mine.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{data.canManage ? en.meals.requests : en.meals.pending}</Text>
              {mine.map((r) => (
                <PendingRow
                  key={r.id}
                  request={r}
                  review={data.canManage}
                  busy={withdraw.isPending || decide.isPending}
                  onWithdraw={(id) => withdraw.mutate(id)}
                  onDecide={(id, status) => decide.mutate({ id, status })}
                />
              ))}
            </View>
          ) : null}

          {daysOfMonth(month).map((date) => (
            <DayRow
              key={`${target}-${date}`}
              date={date}
              saved={entries.get(date) ?? ZERO}
              today={date === today}
              locked={closedGroup || (date < today && !windowOpen && !data.canManage)}
              saving={savingDate === date}
              onSave={(d, counts) => save.mutate({ date: d, counts })}
            />
          ))}
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
  error: { color: theme.colors.error, marginBottom: theme.spacing.sm },
  notice: { color: theme.colors.text, backgroundColor: '#eff6ff', padding: theme.spacing.sm, borderRadius: theme.radius },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.text },
  window: { gap: theme.spacing.sm },
  section: { gap: theme.spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  pending: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.sm },
  pendingText: { flexShrink: 1 },
  decide: { flexDirection: 'row', gap: theme.spacing.sm },
  chips: { gap: theme.spacing.sm },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 6, paddingHorizontal: theme.spacing.md },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  withdraw: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 6, paddingHorizontal: theme.spacing.md },
  day: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, gap: theme.spacing.sm },
  today: { borderColor: theme.colors.primary },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { fontWeight: '600', color: theme.colors.text },
  steppers: { flexDirection: 'row', justifyContent: 'space-between' },
  stepper: { alignItems: 'center', gap: 4 },
  kind: { color: theme.colors.muted, fontSize: 13 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  step: { width: 36, height: 36, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, color: theme.colors.text },
  disabled: { opacity: 0.4 },
  count: { minWidth: 20, textAlign: 'center', fontSize: 18, color: theme.colors.text },
  save: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing.sm, alignItems: 'center' },
  saveText: { color: theme.colors.primaryText, fontWeight: '600' },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, alignItems: 'center' },
  buttonText: { color: theme.colors.text },
});
