import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Notice, Screen, Title } from '../components/ui';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchUserPlaces, fetchUserRules, updateUserProfile } from '../lib/supabaseSync';
import { useStore } from '../store';
import { font, T } from '../theme';

export default function AuthScreen() {
  const store = useStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase is not configured. Please check environment variables.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.session) {
          await onAuthSuccess(data.session.user.id);
          router.back();
        } else {
          setSuccessMsg('Account created! Please check your email to confirm registration.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.user) {
          await onAuthSuccess(data.user.id);
          router.back();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const onAuthSuccess = async (userId: string) => {
    // Sync current profile preferences to Supabase
    await updateUserProfile(userId, {
      lang: store.lang,
      isPro: store.isPro,
      tempUnit: store.units.temp,
      windUnit: store.units.wind,
    }).catch(() => undefined);

    // Fetch cloud places & merge with local places
    const cloudPlaces = await fetchUserPlaces(userId).catch(() => []);
    for (const p of cloudPlaces) {
      store.addPlace(p);
    }

    // Fetch cloud rules
    const cloudRules = await fetchUserRules(userId).catch(() => []);
    if (cloudRules.length > 0) {
      store.setPrefs({ rules: cloudRules });
    }
  };

  return (
    <Screen tabs={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title>{isSignUp ? 'Create Account' : 'Sign In'}</Title>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: T.link }}>Close</Text>
        </Pressable>
      </View>

      <Text style={{ fontFamily: font.regular, fontSize: 15, color: T.muted }}>
        Sign in to save your locations and sync custom weather alert preferences across all your devices.
      </Text>

      {errorMsg && <Notice tone="error">{errorMsg}</Notice>}
      {successMsg && <Notice tone="info">{successMsg}</Notice>}

      <Card style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={T.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={T.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={{ marginTop: 8 }}>
          <Button
            title={loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
            onPress={handleAuth}
            loading={loading}
          />
        </View>
      </Card>

      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <Pressable
          onPress={() => {
            setIsSignUp(!isSignUp);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          style={{ padding: 10 }}
        >
          <Text style={{ fontFamily: font.semibold, fontSize: 14, color: T.link }}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputLabel: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: T.text,
  },
  input: {
    backgroundColor: T.chip,
    color: T.text,
    fontFamily: font.regular,
    fontSize: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
});
