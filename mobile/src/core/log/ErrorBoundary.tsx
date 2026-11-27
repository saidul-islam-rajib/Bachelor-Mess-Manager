import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { logError } from '@/core/log';
import { en } from '@/core/i18n/en';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError('app.boundary', error, { component: (info.componentStack ?? '').split('\n').slice(0, 5).join('\n') });
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text>{en.common.crashed}</Text>
          <Pressable onPress={() => this.setState({ failed: false })}>
            <Text>{en.common.retry}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
