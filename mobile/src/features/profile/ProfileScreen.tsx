import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/client';
import { en, t } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { theme } from '@/core/theme';
import {
  createRoleRequest,
  fetchMyRoleRequests,
  fetchProfile,
  fetchSiteSettings,
  patchProfile,
  PROFILE_KEY,
  ROLE_REQUESTS_KEY,
} from './api';
import type { Theme } from './schemas';

const THEMES: Theme[] = ['system', 'light', 'dark'];

const message = (e: unknown) => (e instanceof ApiError ? e.message : en.profile.failed);

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const client = useQueryClient();
  const userId = user?.id ?? '';
  const profile = useQuery({ queryKey: [...PROFILE_KEY, userId], queryFn: () => fetchProfile(userId), enabled: !!userId });
  const site = useQuery({ queryKey: ['site-settings'], queryFn: fetchSiteSettings, enabled: !!userId });
  const requests = useQuery({ queryKey: ROLE_REQUESTS_KEY, queryFn: fetchMyRoleRequests, enabled: !!userId });

  const [nameEdit, setName] = useState<string | null>(null);
  const [phoneEdit, setPhone] = useState<string | null>(null);
  const [themeEdit, setChosenTheme] = useState<Theme | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const member = profile.data?.member;
  const name = nameEdit ?? member?.name ?? '';
  const phone = phoneEdit ?? member?.phone ?? '';
  const chosenTheme = themeEdit ?? 'system';

  const save = useMutation({
    mutationFn: patchProfile,
    onMutate: () => {
      setNotice(null);
      setError(null);
    },
    onError: (e) => setError(message(e)),
  });

  const saveDetails = () =>
    save.mutate(
      { name: name.trim(), phone: phone.trim() ? phone.trim() : null, ...(themeEdit ? { theme: themeEdit } : {}) },
      {
        onSuccess: (res) => {
          setNotice(en.profile.saved);
          setName(null);
          setPhone(null);
          void client.invalidateQueries({ queryKey: PROFILE_KEY });
        },
      },
    );

  const changePassword = () =>
    save.mutate(
      { password: newPassword, currentPassword },
      {
        onSuccess: (res) => {
          setCurrentPassword('');
          setNewPassword('');
          if (res.passwordChanged) void signOut();
          else setNotice(en.profile.saved);
        },
      },
    );

  const ask = useMutation({
    mutationFn: (role: 'SUPERVISOR' | 'MEMBER') => createRoleRequest(role, reason),
    onMutate: () => {
      setNotice(null);
      setError(null);
    },
    onSuccess: (res) => {
      setReason('');
      setNotice(res.message);
      void client.invalidateQueries({ queryKey: ROLE_REQUESTS_KEY });
    },
    onError: (e) => setError(message(e)),
  });

  if (profile.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (profile.isError || !member) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{en.profile.loadFailed}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void profile.refetch()}>
          <Text style={styles.buttonText}>{en.common.retry}</Text>
        </Pressable>
      </View>
    );
  }

  const policy = requests.data?.policy;
  const pending = requests.data?.requests.some((r) => r.status === 'PENDING') ?? false;
  const otherRole = member.role === 'SUPERVISOR' ? 'MEMBER' : 'SUPERVISOR';
  const canAsk = !!policy && !pending && member.role !== 'ADMIN' && (otherRole === 'SUPERVISOR' || policy.allowSelfRoleSwitch);
  const settings = site.data?.settings;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} />}
    >
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.heading}>{en.profile.details}</Text>
      <Text style={styles.meta}>{member.email}</Text>
      <Text style={styles.meta}>{t(en.profile.role, { role: member.role })}</Text>
      <Text style={styles.meta}>{t(en.profile.since, { date: member.memberSince.slice(0, 10) })}</Text>
      <TextInput accessibilityLabel={en.profile.name} placeholder={en.profile.name} style={styles.input} value={name} onChangeText={setName} />
      <TextInput accessibilityLabel={en.profile.phone} placeholder={en.profile.phone} keyboardType="phone-pad" style={styles.input} value={phone} onChangeText={setPhone} />
      <Text style={styles.label}>{en.profile.theme}</Text>
      <View style={styles.row}>
        {THEMES.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: chosenTheme === value }}
            style={[styles.chip, chosenTheme === value && styles.chipOn]}
            onPress={() => setChosenTheme(value)}
          >
            <Text style={chosenTheme === value ? styles.chipTextOn : styles.buttonText}>{en.profile.themes[value]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" disabled={save.isPending || !name.trim()} style={styles.primary} onPress={saveDetails}>
        <Text style={styles.primaryText}>{en.profile.save}</Text>
      </Pressable>

      <Text style={styles.heading}>{en.profile.passwordTitle}</Text>
      <TextInput accessibilityLabel={en.profile.currentPassword} placeholder={en.profile.currentPassword} secureTextEntry style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} />
      <TextInput accessibilityLabel={en.profile.newPassword} placeholder={en.profile.newPassword} secureTextEntry style={styles.input} value={newPassword} onChangeText={setNewPassword} />
      <Text style={styles.meta}>{en.profile.passwordHint}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={save.isPending || !currentPassword || !newPassword}
        style={styles.button}
        onPress={changePassword}
      >
        <Text style={styles.buttonText}>{en.profile.changePassword}</Text>
      </Pressable>

      <Text style={styles.heading}>{en.profile.roleTitle}</Text>
      {requests.data?.requests.slice(0, 3).map((r) => (
        <Text key={r.id} style={styles.meta}>
          {t(en.profile.requestLine, { role: r.requestedRole, status: r.status, date: r.createdAt.slice(0, 10) })}
          {r.decisionNote ? ` · ${r.decisionNote}` : ''}
        </Text>
      ))}
      {pending ? <Text style={styles.meta}>{en.profile.requestPending}</Text> : null}
      {canAsk ? (
        <>
          <TextInput accessibilityLabel={en.profile.reason} placeholder={en.profile.reason} style={styles.input} value={reason} onChangeText={setReason} />
          <Pressable accessibilityRole="button" disabled={ask.isPending} style={styles.button} onPress={() => ask.mutate(otherRole)}>
            <Text style={styles.buttonText}>{otherRole === 'SUPERVISOR' ? en.profile.askSupervisor : en.profile.askMember}</Text>
          </Pressable>
        </>
      ) : null}

      {settings ? (
        <>
          <Text style={styles.heading}>{en.profile.about}</Text>
          <Text style={styles.meta}>{settings.companyName}</Text>
          {settings.contactEmail ? <Text style={styles.meta}>{settings.contactEmail}</Text> : null}
          {settings.contactPhone ? <Text style={styles.meta}>{settings.contactPhone}</Text> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.lg },
  heading: { color: theme.colors.text, fontWeight: '700', fontSize: 18, marginTop: theme.spacing.md },
  label: { color: theme.colors.muted },
  meta: { color: theme.colors.muted },
  notice: { color: theme.colors.primary },
  error: { color: theme.colors.error },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.sm, color: theme.colors.text },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 6, paddingHorizontal: theme.spacing.md },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTextOn: { color: '#ffffff' },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.sm, alignItems: 'center' },
  buttonText: { color: theme.colors.text },
  primary: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing.sm, alignItems: 'center' },
  primaryText: { color: '#ffffff' },
});
