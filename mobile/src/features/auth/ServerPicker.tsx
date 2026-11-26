import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { checkHealth, getBaseUrl, setBaseUrl } from '@/core/api/client';
import { normalizeServerUrl } from '@/core/config';
import { en, t } from '@/core/i18n/en';
import { storage, STORAGE_KEYS } from '@/core/storage';
import { theme } from '@/core/theme';

export function ServerPicker() {
  const [address, setAddress] = useState(getBaseUrl());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(address);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const url = normalizeServerUrl(draft);
    if (!url) {
      setStatus(en.auth.serverInvalid);
      return;
    }
    setBusy(true);
    setStatus(en.auth.checking);
    const ok = await checkHealth(url);
    setBusy(false);
    if (!ok) {
      setStatus(en.auth.serverBad);
      return;
    }
    setBaseUrl(url);
    await storage.set(STORAGE_KEYS.apiUrl, url);
    setAddress(url);
    setStatus(en.auth.serverOk);
    setEditing(false);
  };

  if (!editing) {
    return (
      <View style={styles.row}>
        <Text style={styles.muted}>{t(en.auth.server, { address })}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setDraft(address); setStatus(null); setEditing(true); }}>
          <Text style={styles.link}> · {en.auth.change}</Text>
        </Pressable>
        {status ? <Text style={styles.muted}> {status}</Text> : null}
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.muted}>{en.auth.serverLabel}</Text>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel={en.auth.serverLabel}
      />
      {status ? <Text style={styles.muted}>{status}</Text> : null}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={save}>
          <Text style={styles.link}>{en.auth.checkAndSave}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setEditing(false)}>
          <Text style={styles.link}> · {en.auth.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  muted: { color: theme.colors.muted, fontSize: 13 },
  link: { color: theme.colors.primary, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    padding: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
    color: theme.colors.text,
  },
});
