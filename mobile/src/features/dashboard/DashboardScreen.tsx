import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { en, t } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { theme } from '@/core/theme';
import { QuickReplyCard } from '@/features/meal-prompts/QuickReplyCard';
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
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });
  const data = query.data;
  const current = data?.member?.current ?? null;
  const supervisor = data?.supervisor;
  const admin = data?.admin;
  const supported = !data || data.member !== undefined || supervisor !== undefined || admin !== undefined;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      <Text style={styles.title}>{t(en.dashboard.hello, { name: user?.name ?? '' })}</Text>

      <QuickReplyCard />

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

      {data && data.member && !current ? <Text style={styles.muted}>{en.dashboard.noGroup}</Text> : null}

      {supervisor ? (
        <View style={styles.section}>
          <View style={styles.grid}>
            <Tile label={en.dashboard.supervisorGroups} value={String(supervisor.totals.groups)} />
            <Tile label={en.dashboard.supervisorMembers} value={String(supervisor.totals.members)} />
            <Tile label={en.dashboard.supervisorMeals} value={String(supervisor.totals.meals)} />
            <Tile label={en.dashboard.supervisorMealRate} value={money(supervisor.totals.mealRate)} />
            <Tile label={en.dashboard.supervisorExpense} value={money(supervisor.totals.expense)} />
            <Tile label={en.dashboard.supervisorCollected} value={money(supervisor.totals.collected)} />
            <Tile label={en.dashboard.supervisorOutstanding} value={money(supervisor.totals.outstanding)} />
            <Tile label={en.dashboard.pendingMealChanges} value={String(supervisor.pendingMealChanges.length)} />
          </View>
          <Text style={styles.heading}>{en.dashboard.unpaidHeading}</Text>
          {supervisor.unpaid.length === 0 ? <Text style={styles.muted}>{en.dashboard.noUnpaid}</Text> : null}
          {supervisor.unpaid.map((row) => (
            <View key={`${row.groupId}:${row.id}`} style={styles.row}>
              <Text style={styles.rowText}>{t(en.dashboard.unpaidRow, { name: row.name, group: row.groupName })}</Text>
              <Text style={styles.tileValue}>{money(row.due)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {admin ? (
        <View style={styles.grid}>
          <Tile label={en.dashboard.adminPending} value={String(admin.pendingApprovals)} />
          <Tile label={en.dashboard.adminMembers} value={String(admin.members)} />
          <Tile label={en.dashboard.adminSupervisors} value={String(admin.supervisors)} />
          <Tile label={en.dashboard.adminActiveGroups} value={String(admin.activeGroups)} />
          <Tile label={en.dashboard.adminInactiveGroups} value={String(admin.inactiveGroups)} />
          <Tile label={en.dashboard.adminMemberships} value={String(admin.activeMemberships)} />
        </View>
      ) : null}

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
  section: { gap: theme.spacing.md },
  heading: { fontSize: 17, fontWeight: '600', color: theme.colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.sm },
  rowText: { color: theme.colors.text, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  tile: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md },
  tileLabel: { color: theme.colors.muted, fontSize: 13 },
  tileValue: { color: theme.colors.text, fontSize: 20, fontWeight: '600' },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, alignItems: 'center' },
  buttonText: { color: theme.colors.text },
});
