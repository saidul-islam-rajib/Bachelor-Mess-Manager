import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { en, t } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { theme } from '@/core/theme';
import { fetchDashboard } from './api';

const money = (value: number) => value.toFixed(2);

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

export function DashboardScreen() {
  const { user, signOut } = useAuth();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });
  const data = query.data;
  const current = data?.member?.current ?? null;
  const supported = !data || data.role === 'MEMBER' || data.member !== undefined;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      <Text style={styles.title}>{t(en.dashboard.hello, { name: user?.name ?? '' })}</Text>

      {query.isLoading ? <Text style={styles.muted}>{en.common.loading}</Text> : null}

      {query.isError ? (
        <View>
          <Text style={styles.error}>{en.dashboard.loadFailed}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void query.refetch()}>
            <Text style={styles.buttonText}>{en.common.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {data && !supported ? <Text style={styles.muted}>{en.dashboard.roleNotSupported}</Text> : null}

      {data && supported && !current ? <Text style={styles.muted}>{en.dashboard.noGroup}</Text> : null}

      {current ? (
        <View>
          <View style={styles.headline}>
            <Text style={styles.tileLabel}>
              {current.dailyRate?.isToday ? en.dashboard.todayRate : en.dashboard.latestRate}
            </Text>
            <Text style={styles.headlineValue}>{current.dailyRate ? money(current.dailyRate.rate) : en.dashboard.noRate}</Text>
            {current.dailyRate && !current.dailyRate.isToday ? (
              <Text style={styles.muted}>{t(en.dashboard.rateDate, { date: current.dailyRate.date })}</Text>
            ) : null}
          </View>
          <View style={styles.grid}>
            <Tile label={en.dashboard.monthRate} value={money(current.mealRate)} />
            <Tile label={en.dashboard.meals} value={String(current.meals)} />
            <Tile label={en.dashboard.totalCost} value={money(current.totalCost)} />
            <Tile label={en.dashboard.balance} value={money(current.due)} />
          </View>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" style={styles.button} onPress={() => void signOut()}>
        <Text style={styles.buttonText}>{en.home.signOut}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { fontSize: 22, fontWeight: '600', color: theme.colors.text },
  muted: { color: theme.colors.muted },
  error: { color: theme.colors.error, marginBottom: theme.spacing.sm },
  headline: { alignItems: 'center', paddingVertical: theme.spacing.lg },
  headlineValue: { fontSize: 48, fontWeight: '700', color: theme.colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  tile: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md },
  tileLabel: { color: theme.colors.muted, fontSize: 13 },
  tileValue: { color: theme.colors.text, fontSize: 20, fontWeight: '600' },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, alignItems: 'center' },
  buttonText: { color: theme.colors.text },
});
