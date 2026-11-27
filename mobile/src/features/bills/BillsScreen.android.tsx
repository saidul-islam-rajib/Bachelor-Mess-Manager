import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { BillsScreen as SharedBillsScreen } from './BillsScreen.tsx';

export function BillsScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <SharedBillsScreen />
    </>
  );
}
