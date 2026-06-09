import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DEVICE_ID_KEY = 'PRIVATE_DEVICE_ID';
const AUTH_TOKEN    = 'AUTH_TOKEN';
const USER_ID_KEY   = 'LOGGED_USER_ID';

// async function getOrCreateDeviceId(): Promise<string> {
//   const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
//   if (existing) return existing;

//   let nativeId = 'unknown';
//   try {
//     if (Platform.OS === 'android') {
//       nativeId = Application.getAndroidId() ?? 'android-unknown';
//     } else if (Platform.OS === 'ios') {
//       nativeId = (await Application.getIosIdForVendorAsync()) ?? 'ios-unknown';
//     }
//   } catch {}

//   const raw = await Crypto.digestStringAsync(
//     Crypto.CryptoDigestAlgorithm.SHA256,
//     `${nativeId}_${Date.now()}_${Math.random()}`
//   );
//   const deviceId = raw.slice(0, 32).toUpperCase();
//   await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
//   return deviceId;
// }
async function getOrCreateDeviceId(): Promise<string> {
  // Verifică mai întâi SecureStore
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  // Generează din hardware ID — fără random, fără timestamp
  let nativeId = 'unknown';
  try {
    if (Platform.OS === 'android') {
      nativeId = Application.getAndroidId() ?? 'android-unknown';
    } else if (Platform.OS === 'ios') {
      nativeId = (await Application.getIosIdForVendorAsync()) ?? 'ios-unknown';
    }
  } catch {}

  // SHA-256 doar din hardware ID — același rezultat la reinstalare
  const raw = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nativeId  // ← fără Date.now() și fără Math.random()
  );
  const deviceId = raw.slice(0, 32).toUpperCase();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

type DeviceStatus = 'approved' | 'pending_approval' | 'rejected';

export default function LoginScreen() {
  const [email, setEmail]                       = useState('');
  const [password, setPassword]                 = useState('');
  const [showPassword, setShowPassword]         = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [pendingApproval, setPendingApproval]   = useState(false);
  const [pendingUserName, setPendingUserName]   = useState('');

  const handleLogin = async () => {
  setLoading(true);
  try {
    // 1. Verifică credențialele în employees
    const { data: emp, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name, is_active, is_access_active, password_hash')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !emp) { Alert.alert('Eroare', 'Email sau parolă incorectă.'); return; }
    if (!emp.is_active) { Alert.alert('Cont dezactivat', 'Contactați administratorul.'); return; }

    const inputHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256, password
    );
    if (emp.password_hash !== inputHash) {
      Alert.alert('Eroare', 'Email sau parolă incorectă.');
      return;
    }

    // 2. Generează / recuperează device ID (merge în puk_code)
    const deviceId = await getOrCreateDeviceId();

    // 3. Caută smartphone după puk_code = deviceId
    const { data: phone } = await supabase
      .from('smartphones')
      .select('id, is_active, employee_id')
      .eq('puk_code', deviceId)
      .single();

    if (phone) {
      // Device înregistrat deja
      if (phone.employee_id !== emp.id) {
        Alert.alert('Eroare', 'Dispozitivul este asociat altui angajat.');
        return;
      }
      if (!phone.is_active) {
        // Salvează userId pentru polling
        await SecureStore.setItemAsync(USER_ID_KEY, emp.id);
        setPendingUserName(`${emp.first_name} ${emp.last_name}`);
        setPendingApproval(true);
        return;
      }
      // Activ — intră în app
      await SecureStore.setItemAsync(AUTH_TOKEN, `token-${emp.id}`);
      await SecureStore.setItemAsync(USER_ID_KEY, emp.id);
      router.replace('/(tabs)' as any);
      return;
    }

    // 4. Primul login — INSERT cu puk_code = deviceId
    const { error: insertErr } = await supabase
      .from('smartphones')
      .insert({
        employee_id:   emp.id,
        puk_code:      deviceId,  // ← device ID direct în puk_code
        is_active:     false,
        registered_at: new Date().toISOString(),
      });

    if (insertErr) {
      Alert.alert('Eroare', 'Nu s-a putut înregistra dispozitivul.');
      return;
    }

    await SecureStore.setItemAsync(USER_ID_KEY, emp.id);
    setPendingUserName(`${emp.first_name} ${emp.last_name}`);
    setPendingApproval(true);

  } catch (e: any) {
    Alert.alert('Eroare', 'A apărut o problemă. Verificați conexiunea.');
  } finally {
    setLoading(false);
  }
};


  const handleCheckApproval = async () => {
  setLoading(true);
  try {
    const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    console.log('[Check] Device ID din SecureStore:', deviceId);

    if (!deviceId) {
      Alert.alert('Eroare', 'Device ID negăsit.');
      return;
    }

    const { data: phone, error } = await supabase
      .from('smartphones')
      .select('is_active, puk_code, employee_id')
      .eq('puk_code', deviceId)
      .single();

    console.log('[Check] Phone din DB:', phone);
    console.log('[Check] Error:', error);

    if (error) {
      Alert.alert('Eroare DB', error.message);
      return;
    }

    if (phone?.is_active) {
      const userId = await SecureStore.getItemAsync(USER_ID_KEY);
      await SecureStore.setItemAsync(AUTH_TOKEN, `token-${userId}`);
      router.replace('/(tabs)' as any);
    } else {
      Alert.alert('În așteptare', `is_active = ${phone?.is_active}`);
    }
  } catch (e: any) {
    Alert.alert('Eroare', e.message);
  } finally {
    setLoading(false);
  }
};

  // ─── Ecran așteptare ─────────────────────────────────────────────────────
  if (pendingApproval) {
    return (
      <View style={styles.pendingContainer}>
        <View style={styles.pendingCard}>
          <View style={styles.pendingIconWrap}>
            <Ionicons name="time" size={48} color={colors.primary} />
          </View>
          <Text style={styles.pendingTitle}>Solicitare trimisă</Text>
          <Text style={styles.pendingName}>{pendingUserName}</Text>
          <Text style={styles.pendingDesc}>
            Dispozitivul dvs. a fost înregistrat și este în așteptarea aprobării administratorului.
          </Text>
          <View style={styles.deviceInfoBox}>
            <Ionicons name="phone-portrait-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.deviceInfoText}>
              {Platform.OS === 'android' ? 'Android' : 'iOS'} · ID dispozitiv înregistrat
            </Text>
          </View>
          <TouchableOpacity style={styles.checkBtn} onPress={handleCheckApproval} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="refresh" size={18} color="#fff" />}
            <Text style={styles.checkBtnText}>{loading ? 'Se verifică...' : 'Verifică statusul'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => setPendingApproval(false)}>
            <Text style={styles.backBtnText}>Înapoi la autentificare</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Ecran login ──────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.logoSection}>
        <View style={styles.logoBox}>
          <Ionicons name="lock-closed" size={36} color="#fff" />
        </View>
        <Text style={styles.appName}>Private Access PAC</Text>
        <Text style={styles.appSubtitle}>Sistem de gestiune acces</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="angajat@companie.ro"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Parolă</Text>
          <View style={styles.inputRow}>
            <Ionicons name="key-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Introduceți parola"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="log-in-outline" size={20} color="#fff" />}
          <Text style={styles.loginBtnText}>{loading ? 'Se conectează...' : 'Autentificare'}</Text>
        </TouchableOpacity>

        <View style={styles.deviceNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.deviceNoteText}>
            La primul login, dispozitivul va fi înregistrat și va necesita aprobarea administratorului.
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>© 2026 Private Access PAC · SC Acces Gestionat SRL</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 28, justifyContent: 'center' },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoBox: {
    width: 84, height: 84, borderRadius: 24,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  appName: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  appSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  form: { gap: 4 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.text },
  eyeBtn: { padding: 4 },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  deviceNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 16, padding: 12, backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  deviceNoteText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  footer: { textAlign: 'center', color: colors.textSecondary, fontSize: 11, marginTop: 40 },
  pendingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 28 },
  pendingCard: {
    backgroundColor: colors.surface, borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, elevation: 8,
  },
  pendingIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  pendingTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  pendingName: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  pendingDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 4 },
  deviceInfoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.background, padding: 12, borderRadius: 10, marginTop: 4,
  },
  deviceInfoText: { fontSize: 13, color: colors.textSecondary },
  checkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 28, marginTop: 8, width: '100%',
  },
  checkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backBtn: { marginTop: 4, padding: 8 },
  backBtnText: { color: colors.textSecondary, fontSize: 14 },
});