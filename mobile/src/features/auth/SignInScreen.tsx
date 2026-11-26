import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '@/core/api/client';
import { SHOW_SERVER_PICKER } from '@/core/config';
import { en } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { theme } from '@/core/theme';
import { ServerPicker } from './ServerPicker';

export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(en.auth.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.status === 429 ? en.auth.tooMany : en.auth.invalid);
      } else {
        setError(en.auth.network);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{en.common.appName}</Text>
      <Text style={styles.subtitle}>{en.auth.title}</Text>
      <TextInput
        style={styles.input}
        placeholder={en.auth.email}
        accessibilityLabel={en.auth.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
      />
      <TextInput
        style={styles.input}
        placeholder={en.auth.password}
        accessibilityLabel={en.auth.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" style={styles.button} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color={theme.colors.primaryText} /> : <Text style={styles.buttonText}>{en.auth.submit}</Text>}
      </Pressable>
      {SHOW_SERVER_PICKER ? <View style={styles.server}><ServerPicker /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: 16, color: theme.colors.muted, marginBottom: theme.spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
  },
  error: { color: theme.colors.error, marginBottom: theme.spacing.md },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing.md, alignItems: 'center' },
  buttonText: { color: theme.colors.primaryText, fontWeight: '600' },
  server: { marginTop: theme.spacing.lg },
});
