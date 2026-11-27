import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaymentsScreen as SharedPaymentsScreen } from './PaymentsScreen.tsx';

export function PaymentsScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <SharedPaymentsScreen />
    </>
  );
}
