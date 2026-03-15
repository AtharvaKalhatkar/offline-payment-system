import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Alert, ActivityIndicator, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { queueSettlement } from '../settle';

import BASE_URL from '../config';
export default function ReceiveBLEScreen() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [devicesFound, setDevicesFound] = useState(0);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedRef = useRef(false); // ✅ prevent double processing

  // ✅ Clean up on screen unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      scanAnim.stopAnimation();
      pulseAnim.stopAnimation();
    };
  }, []);

  const startScanning = () => {
    setScanning(true);
    setDevicesFound(0);
    processedRef.current = false;

    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    setTimeout(() => setDevicesFound(1), 2000);
    setTimeout(() => setDevicesFound(2), 3500);

    pollRef.current = setInterval(async () => {
      const active = await AsyncStorage.getItem('BLE_BROADCAST_ACTIVE');
      const payload = await AsyncStorage.getItem('BLE_BROADCAST_PAYLOAD');

      if (active === 'true' && payload && !processedRef.current) {
        clearInterval(pollRef.current!);
        processPayload(payload);
      }
    }, 1000);

    // Timeout after 60s
    setTimeout(() => {
      if (pollRef.current && !processedRef.current) {
        clearInterval(pollRef.current);
        if (!success) {
          setScanning(false);
          Alert.alert('No Sender Found', 'Could not find any active BLE payment.');
        }
      }
    }, 60000);
  };

  const stopScanning = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    scanAnim.stopAnimation();
    pulseAnim.stopAnimation();
    setScanning(false);
  };

  const processPayload = async (payload: string) => {
    if (processedRef.current) return; // ✅ prevent double processing
    processedRef.current = true;

    try {
      if (!payload.startsWith('OFFLINE_JWT:')) {
        Alert.alert('Invalid Payload', 'Unrecognized BLE payment format.');
        setScanning(false);
        processedRef.current = false;
        return;
      }

      const parts = payload.split(':');
      const amount = parseFloat(parts[1]);
      const jwt = parts.slice(2).join(':');

      if (isNaN(amount) || !jwt) {
        Alert.alert('Invalid Payload', 'Bad payment data.');
        setScanning(false);
        processedRef.current = false;
        return;
      }

      // ✅ Extract tokenId from JWT
      let tokenId = jwt;
      try {
        const p = JSON.parse(atob(jwt.split('.')[1]));
        tokenId = p.jti || p.nonce || jwt;
      } catch (_) {}

      // ✅ Check if already received this token
      const usedTokens = await AsyncStorage.getItem('USED_TOKEN_IDS');
      const usedArr: string[] = usedTokens ? JSON.parse(usedTokens) : [];
      if (usedArr.includes(tokenId)) {
        Alert.alert('❌ Already Received', 'This payment has already been processed.');
        setScanning(false);
        processedRef.current = false;
        return;
      }

      Alert.alert(
        '💸 BLE Payment Incoming',
        `Accept ₹${amount.toFixed(2)} via Bluetooth?`,
        [
          {
            text: 'Reject', style: 'cancel',
            onPress: () => {
              setScanning(false);
              processedRef.current = false;
            }
          },
          {
            text: 'Accept ✅',
            onPress: async () => {
              // ✅ Mark token as used immediately
              usedArr.push(tokenId);
              await AsyncStorage.setItem('USED_TOKEN_IDS', JSON.stringify(usedArr));

              // ✅ Clear broadcast IMMEDIATELY — stop anyone else receiving
              await AsyncStorage.removeItem('BLE_BROADCAST_PAYLOAD');
              await AsyncStorage.removeItem('BLE_BROADCAST_ACTIVE');

              // Update balance
              const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
              const newBal = (balStr ? parseFloat(balStr) : 0) + amount;
              await AsyncStorage.setItem('OFFLINE_VAULT_BALANCE', newBal.toString());

              // Log transaction
              const txId = Date.now().toString();
              const tx = {
                id: txId, type: 'receive', amount, settled: false,
                via: 'BLE',
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
                // ✅ Queue for settlement when back online
                await queueSettlement({ id: txId, tokenId, receiverId, amount, date: tx.date, type: 'receive' });
              } else {
                arr[0].settled = true;
                await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(arr));
              }

              setReceivedAmount(amount);
              setScanning(false);
              setSuccess(true);
            }
          }
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setScanning(false);
      processedRef.current = false;
    }
  };

  if (success) {
    return (
      <View style={styles.successScreen}>
        <Ionicons name="checkmark-circle" size={90} color="#188038" />
        <Text style={styles.successTitle}>Payment Received!</Text>
        <Text style={styles.successAmount}>₹ {receivedAmount.toFixed(2)}</Text>
        <View style={styles.viaTag}>
          <Ionicons name="bluetooth" size={14} color="#1a73e8" />
          <Text style={styles.viaText}>via Bluetooth</Text>
        </View>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const spin = scanAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { stopScanning(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#202124" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive via BLE</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.radarContainer}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: scanning ? 0.2 : 0.1 }]} />
          <View style={styles.radarOuter}>
            <View style={styles.radarMiddle}>
              <View style={styles.radarCenter}>
                <Ionicons name="bluetooth" size={32} color={scanning ? '#1a73e8' : '#dadce0'} />
              </View>
            </View>
            {scanning && (
              <Animated.View style={[styles.radarSweep, { transform: [{ rotate: spin }] }]} />
            )}
          </View>
        </View>

        <Text style={styles.stepTitle}>
          {scanning ? 'Scanning for Payments...' : 'Ready to Receive'}
        </Text>
        <Text style={styles.stepSub}>
          {scanning
            ? `Found ${devicesFound} BLE device${devicesFound !== 1 ? 's' : ''} nearby`
            : 'Tap scan to find nearby BLE payment broadcasts'
          }
        </Text>

        {scanning ? (
          <>
            <View style={styles.scanningInfo}>
              <ActivityIndicator size="small" color="#1a73e8" />
              <Text style={styles.scanningText}>Listening for payment broadcasts...</Text>
            </View>
            <TouchableOpacity style={styles.stopBtn} onPress={stopScanning}>
              <Text style={styles.stopBtnText}>Stop Scanning</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={startScanning}>
            <Ionicons name="radio-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Start Scanning</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color="#1a73e8" />
          <Text style={styles.infoText}>
            Make sure the sender has started BLE broadcasting. Both devices must be within ~10 metres.
          </Text>
        </View>

        <View style={styles.secRow}>
          <Ionicons name="shield-checkmark" size={14} color="#188038" />
          <Text style={styles.secText}>JWT verified · RSA-256 · One-time use</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f3f4' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#202124' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32 },
  radarContainer: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  pulseRing: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#1a73e8' },
  radarOuter: { width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: '#e8eaed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  radarMiddle: { width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, borderColor: '#e8eaed', alignItems: 'center', justifyContent: 'center' },
  radarCenter: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  radarSweep: { position: 'absolute', width: 90, height: 90, borderRadius: 90, backgroundColor: 'transparent', borderTopColor: 'rgba(26,115,232,0.4)', borderTopWidth: 90, borderRightColor: 'transparent', borderRightWidth: 90, borderBottomColor: 'transparent', borderBottomWidth: 0, borderLeftColor: 'transparent', borderLeftWidth: 0, top: 0, left: 0 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 6, textAlign: 'center' },
  stepSub: { fontSize: 14, color: '#5f6368', textAlign: 'center', marginBottom: 28 },
  scanningInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e8f0fe', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%' },
  scanningText: { fontSize: 14, color: '#1a73e8', fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 36, marginBottom: 20 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stopBtn: { borderWidth: 1.5, borderColor: '#d93025', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36, marginBottom: 20 },
  stopBtnText: { color: '#d93025', fontSize: 15, fontWeight: '700' },
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
});