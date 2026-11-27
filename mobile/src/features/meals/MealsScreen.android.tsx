import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { MealsScreen as SharedMealsScreen } from './MealsScreen.tsx';

export function MealsScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <SharedMealsScreen />
    </>
  );
}
