import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/client';
import { useAuth } from '@/core/providers/auth';
import { en, t } from '@/core/i18n/en';
import { useGroup } from '@/core/providers/group';
import { theme } from '@/core/theme';
import {
  addCoSupervisor,
  answerInvitation,
  cancelInvitation,
  fetchGroupInvitations,
  fetchMemberDetail,
  fetchMembers,
  fetchMyInvitations,
  handOver,
  removeCoSupervisor,
  removeMember,
  sendInvitation,
  setMemberActive,
} from './api';

type Pending =
  | { kind: 'remove'; userId: string; name: string }
  | { kind: 'reactivate'; userId: string; name: string }
  | { kind: 'leave'; userId: string }
  | { kind: 'handover'; userId: string; name: string }
  | { kind: 'co'; userId: string; name: string }
  | { kind: 'removeCo'; userId: string; name: string };

export function MembersScreen() {
  const { active } = useGroup();
  const { user } = useAuth();
  const groupId = active?.id ?? '';
  const client = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [email, setEmail] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const members = useQuery({ queryKey: ['members', groupId], queryFn: () => fetchMembers(groupId), enabled: !!groupId });
  const mine = useQuery({ queryKey: ['my-invitations'], queryFn: fetchMyInvitations });
  const canManage = members.data?.canManage ?? false;
  const invites = useQuery({ queryKey: ['group-invitations', groupId], queryFn: () => fetchGroupInvitations(groupId), enabled: !!groupId && canManage });
  const detail = useQuery({ queryKey: ['member-detail', groupId, openId], queryFn: () => fetchMemberDetail(groupId, openId ?? ''), enabled: !!groupId && !!openId });

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['members', groupId] }),
      client.invalidateQueries({ queryKey: ['group-invitations', groupId] }),
      client.invalidateQueries({ queryKey: ['my-invitations'] }),
      client.invalidateQueries({ queryKey: ['groups'] }),
    ]);
  const fail = (e: unknown) => {
    setPending(null);
    setNotice(e instanceof ApiError ? e.message : en.members.actionFailed);
  };
  const done = (message: string) => () => {
    setPending(null);
    setNotice(message);
    return refresh();
  };
  const invite = useMutation({
    mutationFn: (value: string) => sendInvitation(groupId, value),
    onSuccess: () => {
      setEmail('');
      return done(en.members.invited)();
    },
    onError: fail,
  });
  const cancel = useMutation({ mutationFn: (id: string) => cancelInvitation(id), onSuccess: done(en.members.cancelled), onError: fail });
  const answer = useMutation({
    mutationFn: (b: { id: string; status: 'ACCEPTED' | 'REJECTED' }) => answerInvitation(b.id, b.status),
    onSuccess: (_, b) => done(b.status === 'ACCEPTED' ? en.members.accepted : en.members.declined)(),
    onError: fail,
  });
  const act = useMutation({
    mutationFn: async (p: Pending) => {
      if (p.kind === 'remove' || p.kind === 'leave') return removeMember(groupId, p.userId);
      if (p.kind === 'reactivate') return setMemberActive(groupId, p.userId, true);
      if (p.kind === 'handover') return handOver(groupId, p.userId);
      if (p.kind === 'co') return addCoSupervisor(groupId, p.userId);
      return removeCoSupervisor(groupId, p.userId);
    },
    onSuccess: done(en.members.updated),
    onError: fail,
  });

  if (!active) return <Text style={styles.empty}>{en.group.none}</Text>;

  const busy = invite.isPending || cancel.isPending || answer.isPending || act.isPending;
  const list = members.data?.members ?? [];
  const main = list.find((m) => m.isSupervisor);
  const isMain = !!members.data && (members.data.isAdmin || main?.id === user?.id);
  const prompt = (p: Pending) => {
    switch (p.kind) {
      case 'remove':
        return t(en.members.confirmRemove, { name: p.name });
      case 'reactivate':
        return t(en.members.confirmReactivate, { name: p.name });
      case 'leave':
        return en.members.confirmLeave;
      case 'handover':
        return t(en.members.confirmHandover, { name: p.name });
      case 'co':
        return t(en.members.confirmCo, { name: p.name });
      case 'removeCo':
        return t(en.members.confirmRemoveCo, { name: p.name });
    }
  };
  const askInvite = () => {
    const value = email.trim();
    if (!value) {
      setNotice(en.members.inviteEmpty);
      return;
    }
    setNotice(null);
    invite.mutate(value);
  };
  const reload = () => void Promise.all([members.refetch(), mine.refetch()]);
  const myInvites = (mine.data?.invitations ?? []).filter((i) => i.status === 'PENDING');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={members.isRefetching} onRefresh={reload} />}>
      <Text style={styles.heading}>{en.members.title}</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {members.isLoading ? <Text style={styles.muted}>{en.common.loading}</Text> : null}
      {members.isError ? (
        <View>
          <Text style={styles.error}>{en.members.loadFailed}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={reload}>
            <Text style={styles.buttonText}>{en.common.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {pending ? (
        <View style={styles.card}>
          <Text style={styles.text}>{prompt(pending)}</Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, styles.grow]} onPress={() => act.mutate(pending)}>
              <Text style={styles.primaryText}>{en.members.confirm}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setPending(null)}>
              <Text style={styles.buttonText}>{en.members.cancel}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {myInvites.length > 0 || mine.data ? (
        <View style={styles.card}>
          <Text style={styles.title}>{en.members.invitations}</Text>
          {myInvites.length === 0 ? <Text style={styles.muted}>{en.members.noInvitations}</Text> : null}
          {myInvites.map((i) => (
            <View key={i.id} style={styles.gap}>
              <Text style={styles.text}>{t(en.members.invitationRow, { group: i.group.name, name: i.inviter.name })}</Text>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, styles.grow]} onPress={() => answer.mutate({ id: i.id, status: 'ACCEPTED' })}>
                  <Text style={styles.primaryText}>{en.members.accept}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, styles.grow]} onPress={() => answer.mutate({ id: i.id, status: 'REJECTED' })}>
                  <Text style={styles.buttonText}>{en.members.decline}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {members.data ? (
        <View style={styles.card}>
          {list.map((m) => {
            const self = m.id === user?.id;
            return (
              <View key={m.id} style={[styles.gap, styles.line]}>
                <Pressable accessibilityRole="button" accessibilityLabel={m.name} onPress={() => setOpenId(openId === m.id ? null : m.id)} style={styles.head}>
                  <Text style={m.isActive ? styles.title : styles.muted}>{m.name}</Text>
                  <Text style={styles.muted}>
                    {m.isSupervisor ? en.members.supervisor : m.isCoSupervisor ? en.members.coSupervisor : !m.isActive ? en.members.inactive : t(en.members.stayDays, { days: String(m.stayDays) })}
                  </Text>
                </Pressable>
                {openId === m.id ? (
                  <View style={styles.gap}>
                    {detail.isLoading ? <Text style={styles.muted}>{en.common.loading}</Text> : null}
                    {detail.isError ? <Text style={styles.error}>{en.members.detailFailed}</Text> : null}
                    {detail.data ? (
                      <>
                        <Text style={styles.text}>{t(en.members.detailMeals, { count: String(detail.data.meals.total) })}</Text>
                        <Text style={styles.text}>{t(en.members.detailPaid, { amount: String(detail.data.money.collected) })}</Text>
                        <Text style={styles.text}>{t(en.members.detailDue, { amount: String(detail.data.money.due) })}</Text>
                      </>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.row}>
                  {self && m.isActive && !m.isSupervisor ? (
                    <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => setPending({ kind: 'leave', userId: m.id })}>
                      <Text style={styles.buttonText}>{en.members.leave}</Text>
                    </Pressable>
                  ) : null}
                  {canManage && !self && !m.isSupervisor && m.isActive ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${en.members.remove} ${m.name}`} disabled={busy} style={styles.button} onPress={() => setPending({ kind: 'remove', userId: m.id, name: m.name })}>
                      <Text style={styles.buttonText}>{en.members.remove}</Text>
                    </Pressable>
                  ) : null}
                  {canManage && !m.isActive ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${en.members.reactivate} ${m.name}`} disabled={busy} style={styles.button} onPress={() => setPending({ kind: 'reactivate', userId: m.id, name: m.name })}>
                      <Text style={styles.buttonText}>{en.members.reactivate}</Text>
                    </Pressable>
                  ) : null}
                  {isMain && !self && m.isActive && !m.isSupervisor ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${en.members.makeSupervisor} ${m.name}`} disabled={busy} style={styles.button} onPress={() => setPending({ kind: 'handover', userId: m.id, name: m.name })}>
                      <Text style={styles.buttonText}>{en.members.makeSupervisor}</Text>
                    </Pressable>
                  ) : null}
                  {isMain && !self && m.isActive && !m.isSupervisor ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${m.isCoSupervisor ? en.members.removeCo : en.members.makeCo} ${m.name}`}
                      disabled={busy}
                      style={styles.button}
                      onPress={() => setPending({ kind: m.isCoSupervisor ? 'removeCo' : 'co', userId: m.id, name: m.name })}
                    >
                      <Text style={styles.buttonText}>{m.isCoSupervisor ? en.members.removeCo : en.members.makeCo}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {canManage ? (
        <View style={styles.card}>
          <Text style={styles.title}>{en.members.invite}</Text>
          <TextInput accessibilityLabel={en.members.inviteEmail} placeholder={en.members.inviteEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} value={email} onChangeText={setEmail} />
          <Pressable accessibilityRole="button" disabled={busy} style={styles.primary} onPress={askInvite}>
            <Text style={styles.primaryText}>{en.members.inviteSend}</Text>
          </Pressable>
          {(invites.data?.invitations ?? []).filter((i) => i.status === 'PENDING').length > 0 ? <Text style={styles.title}>{en.members.pendingInvites}</Text> : null}
          {(invites.data?.invitations ?? [])
            .filter((i) => i.status === 'PENDING')
            .map((i) => (
              <View key={i.id} style={styles.head}>
                <Text style={styles.text}>{i.invitee.email}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`${en.members.cancelInvite} ${i.invitee.email}`} disabled={busy} style={styles.button} onPress={() => cancel.mutate(i.id)}>
                  <Text style={styles.buttonText}>{en.members.cancel}</Text>
                </Pressable>
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
  heading: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  muted: { color: theme.colors.muted },
  text: { color: theme.colors.text },
  error: { color: theme.colors.error, marginBottom: theme.spacing.sm },
  notice: { color: theme.colors.text, backgroundColor: '#eff6ff', padding: theme.spacing.sm, borderRadius: theme.radius },
  card: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, gap: theme.spacing.sm },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm },
  gap: { gap: theme.spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  title: { fontWeight: '600', color: theme.colors.text },
  row: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  grow: { flex: 1 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.sm, color: theme.colors.text },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 8, paddingHorizontal: theme.spacing.md, alignItems: 'center' },
  buttonText: { color: theme.colors.text },
  primary: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing.sm, alignItems: 'center' },
  primaryText: { color: theme.colors.primaryText, fontWeight: '600' },
});
