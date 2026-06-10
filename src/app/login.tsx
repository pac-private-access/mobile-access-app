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

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  let nativeId = 'unknown';
  try {
    if (Platform.OS === 'android') {
      nativeId = Application.getAndroidId() ?? 'android-unknown';
    } else if (Platform.OS === 'ios') {
      nativeId = (await Application.getIosIdForVendorAsync()) ?? 'ios-unknown';
    }
  } catch {}

  const raw = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nativeId
  );
  const deviceId = raw.slice(0, 32).toUpperCase();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export default function LoginScreen() {
  const [email, setEmail]                           = useState('');
  const [password, setPassword]                     = useState('');
  const [showPassword, setShowPassword]             = useState(false);
  const [loading, setLoading]                       = useState(false);

  // Pas 1 — email verificat, afișează câmpul parolă
  const [emailChecked, setEmailChecked]             = useState(false);

  // Ecran așteptare aprobare
  const [pendingApproval, setPendingApproval]       = useState(false);
  const [pendingUserName, setPendingUserName]       = useState('');

  // Ecran setare parolă
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [cnpInput, setCnpInput]                     = useState('');
  const [newPassword, setNewPassword]               = useState('');
  const [confirmPassword, setConfirmPassword]       = useState('');
  const [showNewPassword, setShowNewPassword]       = useState(false);
  const [pendingEmployeeId, setPendingEmployeeId]   = useState('');
  const [pendingCnp, setPendingCnp]                 = useState('');

  // ─── Pas 1 — verifică email ───────────────────────────────────────────────
  const handleCheckEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Eroare', 'Introduceți email-ul.');
      return;
    }

    setLoading(true);
    try {
      const { data: emp, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, is_active, password_hash, cnp')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (error || !emp) {
        Alert.alert('Eroare', 'Email-ul nu a fost găsit.');
        return;
      }

      if (!emp.is_active) {
        Alert.alert('Cont dezactivat', 'Contactați administratorul.');
        return;
      }

      // Prima logare — nu are parolă → direct la activare cont
      if (!emp.password_hash) {
        setPendingEmployeeId(emp.id);
        setPendingUserName(`${emp.first_name} ${emp.last_name}`);
        setPendingCnp(emp.cnp);
        setNeedsPasswordSetup(true);
        return;
      }

      // Are parolă → afișează câmpul parolă
      setEmailChecked(true);

    } catch (e: any) {
      Alert.alert('Eroare', 'A apărut o problemă. Verificați conexiunea.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Pas 2 — verifică parola ──────────────────────────────────────────────
  const handleLogin = async () => {
    if (!password.trim()) {
      Alert.alert('Eroare', 'Introduceți parola.');
      return;
    }

    setLoading(true);
    try {
      const { data: emp, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, is_access_active, password_hash')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (error || !emp) {
        Alert.alert('Eroare', 'A apărut o problemă.');
        return;
      }

      const inputHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      if (emp.password_hash !== inputHash) {
        Alert.alert('Eroare', 'Parolă incorectă.');
        return;
      }

      await handleDeviceRegistration(emp.id, `${emp.first_name} ${emp.last_name}`);

    } catch (e: any) {
      Alert.alert('Eroare', 'A apărut o problemă. Verificați conexiunea.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Setare parolă cu verificare CNP ─────────────────────────────────────
  const handleSetPassword = async () => {
    if (!cnpInput.trim()) {
      Alert.alert('Eroare', 'Introduceți CNP-ul.');
      return;
    }
    if (cnpInput.trim() !== pendingCnp) {
      Alert.alert('Eroare', 'CNP incorect.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Eroare', 'Parola trebuie să aibă minim 6 caractere.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Eroare', 'Parolele nu coincid.');
      return;
    }

    setLoading(true);
    try {
      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        newPassword
      );

      const { error } = await supabase
        .from('employees')
        .update({ password_hash: hashedPassword })
        .eq('id', pendingEmployeeId);

      if (error) {
        Alert.alert('Eroare', 'Nu s-a putut seta parola: ' + error.message);
        return;
      }

      setNeedsPasswordSetup(false);
      setCnpInput('');
      setNewPassword('');
      setConfirmPassword('');

      await handleDeviceRegistration(pendingEmployeeId, pendingUserName);

    } catch (e: any) {
      Alert.alert('Eroare', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Înregistrare dispozitiv ──────────────────────────────────────────────
  const handleDeviceRegistration = async (employeeId: string, userName: string) => {
    const deviceId = await getOrCreateDeviceId();

    const { data: phone } = await supabase
      .from('smartphones')
      .select('id, is_active, employee_id')
      .eq('puk_code', deviceId)
      .single();

    if (phone) {
      if (phone.employee_id !== employeeId) {
        Alert.alert('Eroare', 'Dispozitivul este asociat altui angajat.');
        return;
      }
      if (!phone.is_active) {
        await SecureStore.setItemAsync(USER_ID_KEY, employeeId);
        setPendingUserName(userName);
        setPendingApproval(true);
        return;
      }
      await SecureStore.setItemAsync(AUTH_TOKEN, `token-${employeeId}`);
      await SecureStore.setItemAsync(USER_ID_KEY, employeeId);
      router.replace('/(tabs)' as any);
      return;
    }

    const { error: insertErr } = await supabase
      .from('smartphones')
      .insert({
        employee_id:   employeeId,
        puk_code:      deviceId,
        is_active:     false,
        registered_at: new Date().toISOString(),
      });

    if (insertErr) {
      Alert.alert('Eroare', 'Nu s-a putut înregistra dispozitivul.');
      return;
    }

    await SecureStore.setItemAsync(USER_ID_KEY, employeeId);
    setPendingUserName(userName);
    setPendingApproval(true);
  };

  // ─── Verificare aprobare ──────────────────────────────────────────────────
  const handleCheckApproval = async () => {
    setLoading(true);
    try {
      const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (!deviceId) {
        Alert.alert('Eroare', 'Device ID negăsit.');
        return;
      }

      const { data: phone, error } = await supabase
        .from('smartphones')
        .select('is_active, puk_code, employee_id')
        .eq('puk_code', deviceId)
        .single();

      if (error) {
        Alert.alert('Eroare DB', error.message);
        return;
      }

      if (phone?.is_active) {
        const userId = await SecureStore.getItemAsync(USER_ID_KEY);
        await SecureStore.setItemAsync(AUTH_TOKEN, `token-${userId}`);
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('În așteptare', 'Cererea nu a fost aprobată încă.');
      }
    } catch (e: any) {
      Alert.alert('Eroare', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Ecran setare parolă ──────────────────────────────────────────────────
  if (needsPasswordSetup) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoBox, { backgroundColor: '#10B981' }]}>
            <Ionicons name="key" size={36} color="#fff" />
          </View>
          <Text style={styles.appName}>Activare cont</Text>
          <Text style={styles.appSubtitle}>Bun venit, {pendingUserName}!</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              Introduceți CNP-ul pentru verificarea identității și setați o parolă personală.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>CNP</Text>
            <View style={styles.inputRow}>
              <Ionicons name="card-outline" size={18}
                color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Introduceți CNP-ul"
                placeholderTextColor={colors.textSecondary}
                value={cnpInput}
                onChangeText={setCnpInput}
                keyboardType="numeric"
                maxLength={13}
                editable={!loading}
                autoFocus
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Parolă nouă</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18}
                color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Minim 6 caractere"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20} color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirmă parola</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18}
                color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Repetă parola"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showNewPassword}
                editable={!loading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.loginBtn,
              { backgroundColor: '#10B981' },
              loading && styles.loginBtnDisabled
            ]}
            onPress={handleSetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
            <Text style={styles.loginBtnText}>
              {loading ? 'Se activează...' : 'Activează contul'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setNeedsPasswordSetup(false);
              setCnpInput('');
              setNewPassword('');
              setConfirmPassword('');
            }}
          >
            <Text style={styles.backBtnText}>Înapoi la autentificare</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── Ecran așteptare aprobare ─────────────────────────────────────────────
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
          <TouchableOpacity
            style={styles.checkBtn}
            onPress={handleCheckApproval}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="refresh" size={18} color="#fff" />}
            <Text style={styles.checkBtnText}>
              {loading ? 'Se verifică...' : 'Verifică statusul'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setPendingApproval(false)}
          >
            <Text style={styles.backBtnText}>Înapoi la autentificare</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Ecran login principal ────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.logoSection}>
        <View style={styles.logoBox}>
          <Ionicons name="lock-closed" size={36} color="#fff" />
        </View>
        <Text style={styles.appName}>Private Access PAC</Text>
        <Text style={styles.appSubtitle}>Sistem de gestiune acces</Text>
      </View>

      <View style={styles.form}>

        {/* ─── Email ───────────────────────────────────────────────────── */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18}
              color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="angajat@companie.ro"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                // Resetează pasul 2 dacă schimbă email-ul
                if (emailChecked) {
                  setEmailChecked(false);
                  setPassword('');
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {/* Buton schimbare email după verificare */}
            {emailChecked && (
              <TouchableOpacity
                onPress={() => {
                  setEmailChecked(false);
                  setPassword('');
                }}
                style={styles.eyeBtn}
              >
                <Ionicons name="close-circle-outline" size={20}
                  color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── Parolă — vizibil doar după verificare email ─────────────── */}
        {emailChecked && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Parolă</Text>
            <View style={styles.inputRow}>
              <Ionicons name="key-outline" size={18}
                color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Introduceți parola"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20} color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── Buton principal ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.loginBtn,
            (loading || !email.trim() || (emailChecked && !password.trim())) && styles.loginBtnDisabled
          ]}
          onPress={emailChecked ? handleLogin : handleCheckEmail}
          disabled={loading || !email.trim() || (emailChecked && !password.trim())}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons
                name={emailChecked ? 'log-in-outline' : 'arrow-forward-outline'}
                size={20} color="#fff"
              />}
          <Text style={styles.loginBtnText}>
            {loading
              ? 'Se conectează...'
              : emailChecked ? 'Autentificare' : 'Continuare'}
          </Text>
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
  appSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
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
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginBottom: 20, padding: 12, backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});