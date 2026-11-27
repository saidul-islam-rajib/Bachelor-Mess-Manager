import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { DashboardScreen as SharedDashboardScreen } from './DashboardScreen.tsx';

export function DashboardScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <SharedDashboardScreen />
    </>
  );
}
