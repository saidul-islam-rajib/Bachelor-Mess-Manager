import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SettlementScreen as SharedSettlementScreen } from './SettlementScreen.tsx';

export function SettlementScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <SharedSettlementScreen />
    </>
  );
}
