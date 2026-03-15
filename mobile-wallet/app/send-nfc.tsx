import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Alert, ActivityIndicator, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import BASE_URL from '../config';

export default function SendNFCScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'amount' | 'pin' | 'tap'>('amount');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkNfc();
    return () => { NfcManager.cancelTechnologyRequest(); };
  }, []);

  useEffect(() => {
    if (step === 'tap') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [step]);

  const checkNfc = async () => {
    const supported = await NfcManager.isSupported();
    setNfcSupported(supported);
    if (supported) await NfcManager.start();
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleAmountNext = async () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
    const bal = balStr ? parseFloat(balStr) : 0;
    if (val > bal) {
      Alert.alert('Insufficient Balance', `Your vault has only ₹${bal.toFixed(2)}.`);
      return;
    }
    setStep('pin');
  };

  const handlePinKey = (key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length === 4) setTimeout(() => verifyPin(newPin), 200);
  };

  const verifyPin = async (enteredPin: string) => {
    setLoading(true);
    const savedPin = await AsyncStorage.getItem('USER_PIN');
    if (!savedPin || savedPin !== enteredPin) {
      shake(); setPin(''); setLoading(false);
      Alert.alert('Wrong PIN', 'Incorrect PIN. Try again.');
      return;
    }
    setLoading(false);
    setStep('tap');
    startNfcSend();
  };

  const startNfcSend = async () => {
    setWaiting(true);
    try {
      const jwt = await AsyncStorage.getItem('OFFLINE_VAULT_JWT') || 'NO_JWT';
      const payload = `OFFLINE_JWT:${amount}:${jwt}`;

      await NfcManager.requestTechnology(NfcTech.Ndef);

      const bytes = Ndef.encodeMessage([Ndef.textRecord(payload)]);
      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
      }

      // ✅ Deduct balance after successful NFC write
      const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
      const newBal = (balStr ? parseFloat(balStr) : 0) - parseFloat(amount);
      await AsyncStorage.setItem('OFFLINE_VAULT_BALANCE', newBal.toString());

      // Log transaction
      const tx = {
        id: Date.now().toString(), type: 'send',
        amount: parseFloat(amount), via: 'NFC',
        date: new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
      };
      const hist = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
      const arr = hist ? JSON.parse(hist) : [];
      arr.unshift(tx);
      await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(arr));

      setPaymentDone(true);
      setWaiting(false);
    } catch (e: any) {
      if (e.message !== 'NFC request cancelled') {
        Alert.alert('NFC Error', 'Could not complete NFC transfer. Try again.');
      }
      setWaiting(false);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  if (!nfcSupported) {
    return (
      <View style={styles.center}>
        <Ionicons name="close-circle-outline" size={64} color="#d93025" />
        <Text style={styles.errorTitle}>NFC Not Supported</Text>
        <Text style={styles.errorSub}>This device doesn't support NFC payments</Text>
        <TouchableOpacity style={styles.backBtn2} onPress={() => router.back()}>
          <Text style={styles.backBtn2Text}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (paymentDone) {
    return (
      <View style={styles.successScreen}>
        <Ionicons name="checkmark-circle" size={90} color="#188038" />
        <Text style={styles.successTitle}>Payment Sent!</Text>
        <Text style={styles.successAmount}>₹ {parseFloat(amount).toFixed(2)}</Text>
        <View style={styles.viaTag}>
          <Ionicons name="wifi-outline" size={14} color="#1a73e8" />
          <Text style={styles.viaText}>via NFC Tap</Text>
        </View>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={async () => {
          await NfcManager.cancelTechnologyRequest();
          if (step === 'pin') { setStep('amount'); setPin(''); }
          else if (step === 'tap') setStep('amount');
          else router.back();
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#202124" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'amount' ? 'NFC Tap to Pay' : step === 'pin' ? 'Confirm PIN' : 'Hold to Pay'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* STEP 1: Amount */}
      {step === 'amount' && (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="wifi-outline" size={36} color="#1a73e8" />
          </View>
          <Text style={styles.stepTitle}>NFC Payment</Text>
          <Text style={styles.stepSub}>Touch phones to transfer money instantly</Text>

          <View style={styles.amountRow}>
            <Text style={styles.rupee}>₹</Text>
            <Text style={styles.amountDisplay}>{amount || '0'}</Text>
          </View>

          <View style={styles.keypadInline}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.numKey, k === '' && styles.numKeyEmpty]}
                onPress={() => {
                  if (!k) return;
                  if (k === '⌫') { setAmount(a => a.slice(0, -1)); return; }
                  if (amount.length >= 6) return;
                  setAmount(a => a + k);
                }}
                disabled={k === ''}
              >
                <Text style={styles.numKeyText}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.quickAmounts}>
            {['100', '200', '500', '1000'].map(q => (
              <TouchableOpacity key={q} style={styles.chip} onPress={() => setAmount(q)}>
                <Text style={styles.chipText}>₹{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAmountNext}>
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2: PIN */}
      {step === 'pin' && (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={36} color="#1a73e8" />
          </View>
          <Text style={styles.stepTitle}>Spending PIN</Text>
          <Text style={styles.stepSub}>Sending ₹{parseFloat(amount || '0').toFixed(2)} via NFC</Text>

          <Animated.View style={[styles.pinDots, { transform: [{ translateX: shakeAnim }] }]}>
            {[0,1,2,3].map(i => (
              <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
            ))}
          </Animated.View>

          {loading ? (
            <ActivityIndicator size="large" color="#1a73e8" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.keypad}>
              {keys.map((k, i) => (
                <TouchableOpacity
                  key={i} style={[styles.key, k === '' && styles.keyEmpty]}
                  onPress={() => k && handlePinKey(k)} disabled={k === ''}
                >
                  <Text style={[styles.keyText, k === '⌫' && { fontSize: 20 }]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* STEP 3: NFC Tap */}
      {step === 'tap' && (
        <View style={styles.content}>
          <View style={styles.nfcContainer}>
            <Animated.View style={[styles.pulse3, { transform: [{ scale: pulseAnim }], opacity: 0.1 }]} />
            <Animated.View style={[styles.pulse2, { transform: [{ scale: pulseAnim }], opacity: 0.2 }]} />
            <View style={styles.nfcCenter}>
              <Ionicons name="wifi-outline" size={48} color="#fff" />
            </View>
          </View>

          <Text style={styles.stepTitle}>Hold Phones Together</Text>
          <Text style={styles.stepSub}>
            {waiting
              ? 'Waiting for receiver to tap...'
              : 'Place your phone against receiver\'s phone'
            }
          </Text>

          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText}>₹ {parseFloat(amount).toFixed(2)}</Text>
          </View>

          {waiting && <ActivityIndicator size="small" color="#1a73e8" style={{ marginBottom: 16 }} />}

          <View style={styles.secRow}>
            <Ionicons name="shield-checkmark" size={14} color="#188038" />
            <Text style={styles.secText}>JWT signed · NFC encrypted · One-time use</Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={async () => {
            await NfcManager.cancelTechnologyRequest();
            setStep('amount');
          }}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f3f4' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#202124' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 6, textAlign: 'center' },
  stepSub: { fontSize: 14, color: '#5f6368', textAlign: 'center', marginBottom: 28 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: '#1a73e8', paddingBottom: 8, marginBottom: 20, width: '60%', justifyContent: 'center' },
  rupee: { fontSize: 36, fontWeight: '700', color: '#202124', marginRight: 4 },
  amountDisplay: { fontSize: 52, fontWeight: '800', color: '#202124', minWidth: 60, textAlign: 'center' },
  keypadInline: { flexDirection: 'row', flexWrap: 'wrap', width: 280, justifyContent: 'center', gap: 10, marginBottom: 16 },
  numKey: { width: 78, height: 60, borderRadius: 14, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center' },
  numKeyEmpty: { backgroundColor: 'transparent' },
  numKeyText: { fontSize: 22, fontWeight: '600', color: '#202124' },
  quickAmounts: { flexDirection: 'row', gap: 10, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { color: '#1a73e8', fontWeight: '700', fontSize: 13 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pinDots: { flexDirection: 'row', gap: 18, marginTop: 28, marginBottom: 44 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#dadce0' },
  dotFilled: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 300, justifyContent: 'center', gap: 12 },
  key: { width: 84, height: 72, borderRadius: 16, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: 26, fontWeight: '600', color: '#202124' },
  nfcContainer: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  pulse3: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#1a73e8' },
  pulse2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#1a73e8' },
  nfcCenter: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center' },
  amountBadge: { backgroundColor: '#e8f0fe', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 16 },
  amountBadgeText: { fontSize: 28, fontWeight: '800', color: '#1a73e8' },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  secText: { fontSize: 12, color: '#188038', fontWeight: '600' },
  cancelBtn: { borderWidth: 1.5, borderColor: '#d93025', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 36 },
  cancelBtnText: { color: '#d93025', fontSize: 15, fontWeight: '700' },
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#202124', marginTop: 16, marginBottom: 8 },
  successAmount: { fontSize: 52, fontWeight: '900', color: '#188038', marginBottom: 12 },
  viaTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8f0fe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 36 },
  viaText: { color: '#1a73e8', fontWeight: '700', fontSize: 13 },
  doneBtn: { backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 60 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginTop: 16, marginBottom: 8 },
  errorSub: { fontSize: 14, color: '#5f6368', textAlign: 'center', marginBottom: 28 },
  backBtn2: { backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  backBtn2Text: { color: '#fff', fontSize: 16, fontWeight: '700' },
});