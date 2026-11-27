import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/client';
import { useAuth } from '@/core/providers/auth';
import { en, t } from '@/core/i18n/en';
import { useGroup } from '@/core/providers/group';
import { theme } from '@/core/theme';
import { monthOf, shiftMonth, todayKey } from '@/features/meals/dates';
import { closeMonth, fetchClosings, fetchFinalSettlement, reopenClosing, runFinalSettlement } from './api';

type Pending =
  | { kind: 'close'; month: string }
  | { kind: 'reopen'; id: string; month: string }
  | { kind: 'me' }
  | { kind: 'member'; userId: string; name: string }
  | { kind: 'all'; month: string }
  | { kind: 'mark'; month: string };

export function SettlementScreen() {
  const { active } = useGroup();
  const { user } = useAuth();
  const groupId = active?.id ?? '';
  const client = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [month, setMonth] = useState(shiftMonth(monthOf(todayKey()), -1));
  const [pending, setPending] = useState<Pending | null>(null);
  const closings = useQuery({ queryKey: ['closings', groupId], queryFn: () => fetchClosings(groupId), enabled: !!groupId });
  const final = useQuery({ queryKey: ['final-settlement', groupId], queryFn: () => fetchFinalSettlement(groupId), enabled: !!groupId });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['closings', groupId] }),
      client.invalidateQueries({ queryKey: ['final-settlement', groupId] }),
      client.invalidateQueries({ queryKey: ['payments', groupId] }),
    ]);
  const fail = (e: unknown) => {
    setPending(null);
    setNotice(e instanceof ApiError ? e.message : en.settlement.actionFailed);
  };
  const done = (message: string) => () => {
    setPending(null);
    setNotice(message);
    return refresh();
  };
  const close = useMutation({ mutationFn: (m: string) => closeMonth(groupId, { month: m }), onSuccess: done(en.settlement.closed), onError: fail });
  const reopen = useMutation({ mutationFn: (id: string) => reopenClosing(id), onSuccess: done(en.settlement.reopened), onError: fail });
  const settle = useMutation({
    mutationFn: (b: { action: 'settleMember' | 'settleAll' | 'markSettled'; userId?: string }) => runFinalSettlement(groupId, b),
    onSuccess: done(en.settlement.settled),
    onError: fail,
  });

  if (!active) return <Text style={styles.empty}>{en.group.none}</Text>;

  const canManage = closings.data?.canManage ?? false;
  const settlement = final.data?.settlement ?? null;
  const busy = close.isPending || reopen.isPending || settle.isPending;
  const askClose = () => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setNotice(en.settlement.invalidMonth);
      return;
    }
    setNotice(null);
    setPending({ kind: 'close', month });
  };
  const prompt = (p: Pending) => {
    switch (p.kind) {
      case 'close':
        return t(en.settlement.confirmClose, { month: p.month });
      case 'reopen':
        return t(en.settlement.confirmReopen, { month: p.month });
      case 'me':
        return en.settlement.confirmSettleMe;
      case 'member':
        return t(en.settlement.confirmSettleMember, { name: p.name });
      case 'all':
        return t(en.settlement.confirmSettleAll, { month: p.month });
      case 'mark':
        return t(en.settlement.confirmMarkSettled, { month: p.month });
    }
  };
  const run = () => {
    if (!pending) return;
    if (pending.kind === 'close') close.mutate(pending.month);
    else if (pending.kind === 'reopen') reopen.mutate(pending.id);
    else if (pending.kind === 'me') settle.mutate({ action: 'settleMember', userId: user?.id });
    else if (pending.kind === 'member') settle.mutate({ action: 'settleMember', userId: pending.userId });
    else if (pending.kind === 'all') settle.mutate({ action: 'settleAll' });
    else settle.mutate({ action: 'markSettled' });
  };
  const confirmBox = () =>
    pending ? (
      <View style={styles.card}>
        <Text style={styles.text}>{prompt(pending)}</Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, styles.grow]} onPress={run}>
            <Text style={styles.primaryText}>{en.settlement.confirm}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => setPending(null)}>
            <Text style={styles.buttonText}>{en.settlement.cancel}</Text>
          </Pressable>
        </View>
      </View>
    ) : null;

  const mineFinal = settlement?.members.find((m) => m.id === user?.id);
  const transfers = settlement?.settleUp.transfers ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={closings.isRefetching} onRefresh={() => void Promise.all([closings.refetch(), final.refetch()])} />}
    >
      <Text style={styles.heading}>{en.settlement.title}</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {closings.isLoading || final.isLoading ? <Text style={styles.muted}>{en.common.loading}</Text> : null}
      {closings.isError || final.isError ? (
        <View>
          <Text style={styles.error}>{en.settlement.loadFailed}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void Promise.all([closings.refetch(), final.refetch()])}>
            <Text style={styles.buttonText}>{en.common.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {confirmBox()}
      {final.data ? (
        <View style={styles.card}>
          {settlement ? (
            <>
              <Text style={styles.title}>{t(en.settlement.finalHeading, { month: settlement.monthKey })}</Text>
              <Text style={styles.muted}>{t(en.settlement.closedThrough, { date: settlement.closedThrough })}</Text>
              <View style={styles.head}>
                <Text style={styles.text}>{en.settlement.mealRate}</Text>
                <Text style={styles.title}>{settlement.mealRate}</Text>
              </View>
              {settlement.allClear || settlement.settledAt ? <Text style={styles.ok}>{en.settlement.allClear}</Text> : null}
              <Text style={styles.title}>{en.settlement.yourTransfers}</Text>
              {transfers.length === 0 ? <Text style={styles.muted}>{en.settlement.noTransfers}</Text> : null}
              {transfers.map((tr, i) => (
                <Text key={i} style={styles.text}>
                  {t(tr.direction === 'out' ? en.settlement.transferOut : en.settlement.transferIn, { name: tr.counterpartyName, amount: String(tr.amount) })}
                </Text>
              ))}
              {mineFinal && !settlement.settledAt && mineFinal.liveDue !== 0 ? (
                <Pressable accessibilityRole="button" disabled={busy} style={styles.primary} onPress={() => setPending({ kind: 'me' })}>
                  <Text style={styles.primaryText}>{en.settlement.settleMe}</Text>
                </Pressable>
              ) : null}
              {final.data.canManage
                ? settlement.members.map((m) => (
                    <View key={m.id} style={[styles.head, styles.line]}>
                      <Text style={styles.text}>{t(en.settlement.memberRow, { name: m.name, due: String(m.liveDue) })}</Text>
                      {!settlement.settledAt && m.liveDue !== 0 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t(en.settlement.settleMember, { name: m.name })}
                          disabled={busy}
                          style={styles.small}
                          onPress={() => setPending({ kind: 'member', userId: m.id, name: m.name })}
                        >
                          <Text style={styles.buttonText}>✓</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                : null}
              {final.data.canManage && !settlement.settledAt ? (
                <View style={styles.row}>
                  <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, styles.grow]} onPress={() => setPending({ kind: 'all', month: settlement.monthKey })}>
                    <Text style={styles.primaryText}>{en.settlement.settleAll}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, styles.grow]} onPress={() => setPending({ kind: 'mark', month: settlement.monthKey })}>
                    <Text style={styles.buttonText}>{en.settlement.markSettled}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.muted}>{en.settlement.noFinal}</Text>
          )}
        </View>
      ) : null}
      {canManage ? (
        <View style={styles.card}>
          <Text style={styles.title}>{en.settlement.closeMonth}</Text>
          <TextInput accessibilityLabel={en.settlement.monthLabel} placeholder={en.settlement.monthLabel} style={styles.input} value={month} onChangeText={setMonth} />
          <Pressable accessibilityRole="button" disabled={busy} style={styles.primary} onPress={askClose}>
            <Text style={styles.primaryText}>{en.settlement.closeMonth}</Text>
          </Pressable>
        </View>
      ) : null}
      {closings.data ? (
        <View style={styles.card}>
          <Text style={styles.title}>{en.settlement.closings}</Text>
          {closings.data.closings.length === 0 ? <Text style={styles.muted}>{en.settlement.noClosings}</Text> : null}
          {closings.data.closings.map((c) => {
            const mine = c.lines.find((l) => l.userId === user?.id);
            return (
              <View key={c.id} style={[styles.gap, styles.line]}>
                <View style={styles.head}>
                  <Text style={c.reopenedAt ? styles.muted : styles.title}>{c.monthKey}</Text>
                  <Text style={styles.muted}>{c.settledAt ? t(en.settlement.settledOn, { date: c.settledAt.slice(0, 10) }) : t(en.settlement.closedThrough, { date: c.closedThrough })}</Text>
                </View>
                {mine ? (
                  <View style={styles.head}>
                    <Text style={styles.text}>{en.settlement.myLine}</Text>
                    <Text style={styles.title}>{mine.carryOut}</Text>
                  </View>
                ) : null}
                {canManage ? c.lines.map((l) => <Text key={l.userId} style={styles.muted}>{t(en.settlement.carryOut, { name: l.userName, amount: String(l.carryOut) })}</Text>) : null}
                {canManage && !c.reopenedAt && !c.settledAt ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t(en.settlement.confirmReopen, { month: c.monthKey })} disabled={busy} style={styles.button} onPress={() => setPending({ kind: 'reopen', id: c.id, month: c.monthKey })}>
                    <Text style={styles.buttonText}>{en.settlement.reopen}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      <Text style={styles.muted}>{en.settlement.sectionPlaceholder}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  empty: { padding: theme.spacing.lg, color: theme.colors.muted },
  heading: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  muted: { color: theme.colors.muted },
  text: { color: theme.colors.text },
  ok: { color: theme.colors.text, fontWeight: '600' },
  error: { color: theme.colors.error, marginBottom: theme.spacing.sm },
  notice: { color: theme.colors.text, backgroundColor: '#eff6ff', padding: theme.spacing.sm, borderRadius: theme.radius },
  card: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, gap: theme.spacing.sm },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm },
  gap: { gap: theme.spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  title: { fontWeight: '600', color: theme.colors.text },
  row: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.sm, color: theme.colors.text },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 8, paddingHorizontal: theme.spacing.md, alignItems: 'center' },
  small: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, minWidth: 36, height: 36, paddingHorizontal: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: theme.colors.text },
  primary: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing.sm, alignItems: 'center' },
  primaryText: { color: theme.colors.primaryText, fontWeight: '600' },
});
