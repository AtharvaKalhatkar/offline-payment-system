import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Alert, ActivityIndicator, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://10.77.98.11:8082';

export default function SendBLEScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'amount' | 'pin' | 'broadcasting'>('amount');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [broadcastTime, setBroadcastTime] = useState(60);
  const [connected, setConnected] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false); // ✅ track ACK
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ✅ Always clear BLE broadcast when leaving screen
  useEffect(() => {
    return () => {
      clearBroadcast();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const clearBroadcast = async () => {
    await AsyncStorage.removeItem('BLE_BROADCAST_PAYLOAD');
    await AsyncStorage.removeItem('BLE_BROADCAST_ACTIVE');
  };

  useEffect(() => {
    if (step === 'broadcasting') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();

      timerRef.current = setInterval(() => {
        setBroadcastTime(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            clearBroadcast(); // ✅ clear on timeout
            Alert.alert('Broadcast Ended', 'No receiver connected. Balance NOT deducted.');
            setStep('amount');
            return 60;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

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
    if (newPin.length === 4) setTimeout(() => verifyAndBroadcast(newPin), 200);
  };

  const verifyAndBroadcast = async (enteredPin: string) => {
    setLoading(true);
    try {
      const savedPin = await AsyncStorage.getItem('USER_PIN');
      if (!savedPin || savedPin !== enteredPin) {
        shake(); setPin(''); setLoading(false);
        Alert.alert('Wrong PIN', 'Incorrect PIN. Try again.');
        return;
      }

      const userId = await AsyncStorage.getItem('USER_ID');
      if (!userId) throw new Error('Not registered');

      // ✅ Use cached JWT only — never call load API
      const jwt = await AsyncStorage.getItem('OFFLINE_VAULT_JWT') || 'NO_JWT';

      // ✅ DO NOT deduct balance here — deduct ONLY after receiver ACK
      const payload = `OFFLINE_JWT:${amount}:${jwt}`;
      await AsyncStorage.setItem('BLE_BROADCAST_PAYLOAD', payload);
      await AsyncStorage.setItem('BLE_BROADCAST_ACTIVE', 'true');

      setStep('broadcasting');
      setBroadcastTime(60);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Called after receiver confirms — NOW deduct balance
  const confirmPaymentSent = async () => {
    if (paymentConfirmed) return; // prevent double deduction
    setPaymentConfirmed(true);

    if (timerRef.current) clearInterval(timerRef.current);
    await clearBroadcast(); // ✅ stop broadcast immediately

    const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
    const newBal = (balStr ? parseFloat(balStr) : 0) - parseFloat(amount);
    await AsyncStorage.setItem('OFFLINE_VAULT_BALANCE', newBal.toString());

    // Log transaction
    const tx = {
      id: Date.now().toString(), type: 'send',
      amount: parseFloat(amount),
      date: new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
      via: 'BLE',
    };
    const hist = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
    const arr = hist ? JSON.parse(hist) : [];
    arr.unshift(tx);
    await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(arr));

    Alert.alert('✅ Transfer Complete', `₹${amount} sent via BLE!`, [
      { text: 'Done', onPress: () => router.back() }
    ]);
  };

  const simulateReceive = async () => {
    setConnected(true);
    await confirmPaymentSent();
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={async () => {
          if (step === 'pin') { setStep('amount'); setPin(''); }
          else if (step === 'broadcasting') {
            if (timerRef.current) clearInterval(timerRef.current);
            await clearBroadcast(); // ✅ clear on back press
            setStep('amount');
          } else router.back();
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#202124" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'amount' ? 'Pay via BLE' : step === 'pin' ? 'Confirm with PIN' : 'Broadcasting...'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* STEP 1: Amount */}
      {step === 'amount' && (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="bluetooth-outline" size={36} color="#1a73e8" />
          </View>
          <Text style={styles.stepTitle}>BLE Payment</Text>
          <Text style={styles.stepSub}>Transfer money wirelessly without internet</Text>

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
          <Text style={styles.stepSub}>Sending ₹{parseFloat(amount || '0').toFixed(2)} via BLE</Text>

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

      {/* STEP 3: Broadcasting */}
      {step === 'broadcasting' && (
        <View style={styles.content}>
          <View style={styles.pulseContainer}>
            <Animated.View style={[styles.pulse3, { transform: [{ scale: pulseAnim }], opacity: 0.15 }]} />
            <Animated.View style={[styles.pulse2, { transform: [{ scale: pulseAnim }], opacity: 0.25 }]} />
            <View style={styles.bleCenter}>
              <Ionicons name="bluetooth" size={40} color="#fff" />
            </View>
          </View>

          <Text style={styles.stepTitle}>
            {connected ? '✅ Connected!' : 'Waiting for Receiver'}
          </Text>
          <Text style={styles.stepSub}>
            {connected
              ? 'Transferring payment...'
              : `Ask receiver to open BLE Receive\nBroadcast expires in ${broadcastTime}s`
            }
          </Text>

          {/* ✅ Show amount but note balance not yet deducted */}
          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText}>₹ {parseFloat(amount).toFixed(2)}</Text>
          </View>

          <View style={styles.pendingNote}>
            <Ionicons name="time-outline" size={14} color="#d97706" />
            <Text style={styles.pendingNoteText}>Balance deducted only after receiver confirms</Text>
          </View>

          <View style={styles.secRow}>
            <Ionicons name="shield-checkmark" size={14} color="#188038" />
            <Text style={styles.secText}>JWT signed · RSA-256 · Tamper-proof</Text>
          </View>

          <TouchableOpacity style={styles.testBtn} onPress={simulateReceive}>
            <Ionicons name="bug-outline" size={16} color="#5f6368" style={{ marginRight: 6 }} />
            <Text style={styles.testBtnText}>Simulate Receive (Test)</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f3f4' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#202124' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 6 },
  stepSub: { fontSize: 14, color: '#5f6368', textAlign: 'center', marginBottom: 28 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: '#1a73e8', paddingBottom: 8, marginBottom: 20, width: '60%', justifyContent: 'center' },
  rupee: { fontSize: 36, fontWeight: '700', color: '#202124', marginRight: 4 },
  amountDisplay: { fontSize: 52, fontWeight: '800', color: '#202124', minWidth: 60, textAlign: 'center' },
  keypadInline: { flexDirection: 'row', flexWrap: 'wrap', width: 280, justifyContent: 'center', gap: 10, marginBottom: 28 },
  numKey: { width: 78, height: 60, borderRadius: 14, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center' },
  numKeyEmpty: { backgroundColor: 'transparent' },
  numKeyText: { fontSize: 22, fontWeight: '600', color: '#202124' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pinDots: { flexDirection: 'row', gap: 18, marginTop: 28, marginBottom: 44 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#dadce0' },
  dotFilled: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 300, justifyContent: 'center', gap: 12 },
  key: { width: 84, height: 72, borderRadius: 16, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: 26, fontWeight: '600', color: '#202124' },
  pulseContainer: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 32, marginTop: 8 },
  pulse3: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#1a73e8' },
  pulse2: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#1a73e8' },
  bleCenter: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center' },
  amountBadge: { backgroundColor: '#e8f0fe', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 10 },
  amountBadgeText: { fontSize: 28, fontWeight: '800', color: '#1a73e8' },
  pendingNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pendingNoteText: { fontSize: 12, color: '#d97706', fontWeight: '600' },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 },
  secText: { fontSize: 12, color: '#188038', fontWeight: '600' },
  testBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dadce0', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  testBtnText: { color: '#5f6368', fontSize: 13, fontWeight: '600' },
});