import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { MembersScreen as SharedMembersScreen } from './MembersScreen.tsx';

export function MembersScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <SharedMembersScreen />
    </>
  );
}
