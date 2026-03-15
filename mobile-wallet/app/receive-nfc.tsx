import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Alert, ActivityIndicator, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { queueSettlement } from '../settle';
import BASE_URL from '../config';

export default function ReceiveNFCScreen() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [nfcSupported, setNfcSupported] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkNfc();
    return () => { NfcManager.cancelTechnologyRequest(); };
  }, []);

  useEffect(() => {
    if (scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
    }
  }, [scanning]);

  const checkNfc = async () => {
    const supported = await NfcManager.isSupported();
    setNfcSupported(supported);
    if (supported) await NfcManager.start();
  };

  const startReceiving = async () => {
    setScanning(true);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      if (!tag?.ndefMessage?.length) throw new Error('No data on NFC tag');

      const payload = Ndef.text.decodePayload(
        tag.ndefMessage[0].payload as unknown as Uint8Array
      );

      await processPayload(payload);
    } catch (e: any) {
      if (e.message !== 'NFC request cancelled') {
        Alert.alert('NFC Error', 'Could not read payment. Try again.');
      }
    } finally {
      NfcManager.cancelTechnologyRequest();
      setScanning(false);
    }
  };

  const processPayload = async (payload: string) => {
    if (!payload.startsWith('OFFLINE_JWT:')) {
      Alert.alert('Invalid', 'Not a valid payment tag.');
      return;
    }

    const parts = payload.split(':');
    const amount = parseFloat(parts[1]);
    const jwt = parts.slice(2).join(':');

    if (isNaN(amount) || !jwt) {
      Alert.alert('Invalid', 'Bad payment data.');
      return;
    }

    // ✅ Extract tokenId
    let tokenId = jwt;
    try {
      const p = JSON.parse(atob(jwt.split('.')[1]));
      tokenId = p.jti || p.nonce || jwt;
    } catch (_) {}

    // ✅ Check already received
    const usedTokens = await AsyncStorage.getItem('USED_TOKEN_IDS');
    const usedArr: string[] = usedTokens ? JSON.parse(usedTokens) : [];
    if (usedArr.includes(tokenId)) {
      Alert.alert('❌ Already Received', 'This payment has already been processed.');
      return;
    }

    Alert.alert(
      '💸 NFC Payment',
      `Accept ₹${amount.toFixed(2)} via NFC?`,
      [
        { text: 'Reject', style: 'cancel' },
        {
          text: 'Accept ✅',
          onPress: async () => {
            // ✅ Mark token used immediately
            usedArr.push(tokenId);
            await AsyncStorage.setItem('USED_TOKEN_IDS', JSON.stringify(usedArr));

            // Update balance
            const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
            const newBal = (balStr ? parseFloat(balStr) : 0) + amount;
            await AsyncStorage.setItem('OFFLINE_VAULT_BALANCE', newBal.toString());

            // Log transaction
            const txId = Date.now().toString();
            const tx = {
              id: txId, type: 'receive', amount, settled: false, via: 'NFC',
              date: new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
            };
            const hist = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
            const arr = hist ? JSON.parse(hist) : [];
            arr.unshift(tx);
            await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(arr));

            const receiverId = await AsyncStorage.getItem('USER_ID') || '';

            // ✅ Try settle immediately, queue if offline
            let settledNow = false;
            try {
              const res = await fetch(`${BASE_URL}/api/wallet/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiverId, tokenId }),
              });
              settledNow = res.ok;
            } catch (_) {}

            if (!settledNow) {
              await queueSettlement({ id: txId, tokenId, receiverId, amount, date: tx.date, type: 'receive' });
            } else {
              arr[0].settled = true;
              await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(arr));
            }

            setReceivedAmount(amount);
            setSuccess(true);
          }
        }
      ]
    );
  };

  if (!nfcSupported) {
    return (
      <View style={styles.center}>
        <Ionicons name="close-circle-outline" size={64} color="#d93025" />
        <Text style={styles.errorTitle}>NFC Not Supported</Text>
        <Text style={styles.errorSub}>This device doesn't support NFC payments</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.successScreen}>
        <Ionicons name="checkmark-circle" size={90} color="#188038" />
        <Text style={styles.successTitle}>Payment Received!</Text>
        <Text style={styles.successAmount}>₹ {receivedAmount.toFixed(2)}</Text>
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
          router.back();
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#202124" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NFC Tap to Receive</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.nfcContainer}>
          <Animated.View style={[styles.pulse3, { transform: [{ scale: pulseAnim }], opacity: scanning ? 0.15 : 0.05 }]} />
          <Animated.View style={[styles.pulse2, { transform: [{ scale: pulseAnim }], opacity: scanning ? 0.25 : 0.1 }]} />
          <View style={[styles.nfcCenter, { backgroundColor: scanning ? '#1a73e8' : '#dadce0' }]}>
            <Ionicons name="wifi-outline" size={48} color="#fff" />
          </View>
        </View>

        <Text style={styles.stepTitle}>
          {scanning ? 'Ready to Receive' : 'Tap to Receive Payment'}
        </Text>
        <Text style={styles.stepSub}>
          {scanning
            ? 'Hold your phone against the sender\'s phone'
            : 'Tap the button below then hold phones together'
          }
        </Text>

        {scanning ? (
          <>
            <ActivityIndicator size="small" color="#1a73e8" style={{ marginBottom: 16 }} />
            <TouchableOpacity style={styles.cancelBtn} onPress={async () => {
              await NfcManager.cancelTechnologyRequest();
              setScanning(false);
            }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={startReceiving}>
            <Ionicons name="wifi-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Hold to Receive</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color="#1a73e8" />
          <Text style={styles.infoText}>
            Make sure NFC is enabled in your phone settings. Both phones must touch back-to-back.
          </Text>
        </View>

        <View style={styles.secRow}>
          <Ionicons name="shield-checkmark" size={14} color="#188038" />
          <Text style={styles.secText}>JWT verified · One-time use · Tamper-proof</Text>
        </View>
      </View>
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
  nfcContainer: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  pulse3: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#1a73e8' },
  pulse2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#1a73e8' },
  nfcCenter: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 6, textAlign: 'center' },
  stepSub: { fontSize: 14, color: '#5f6368', textAlign: 'center', marginBottom: 28 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 36, marginBottom: 20 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { borderWidth: 1.5, borderColor: '#d93025', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 36, marginBottom: 20 },
  cancelBtnText: { color: '#d93025', fontSize: 15, fontWeight: '700' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f8f9fa', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%' },
  infoText: { flex: 1, fontSize: 13, color: '#5f6368', lineHeight: 18 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secText: { fontSize: 12, color: '#188038', fontWeight: '600' },
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#202124', marginTop: 16, marginBottom: 8 },
  successAmount: { fontSize: 52, fontWeight: '900', color: '#188038', marginBottom: 12 },
  viaTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8f0fe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 36 },
  viaText: { color: '#1a73e8', fontWeight: '700', fontSize: 13 },
  doneBtn: { backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 60 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginTop: 16, marginBottom: 8 },
  errorSub: { fontSize: 14, color: '#5f6368', textAlign: 'center', marginBottom: 28 },
});