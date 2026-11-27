import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { BazarScreen as SharedBazarScreen } from './BazarScreen.tsx';

export function BazarScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <SharedBazarScreen />
    </>
  );
}
