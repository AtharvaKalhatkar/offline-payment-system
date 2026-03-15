import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { queueSettlement } from '../settle';

import BASE_URL from '../config';
export default function ReceiveQRScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const scannedTokens = useRef<Set<string>>(new Set()); // ✅ track scanned tokenIds

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={64} color="#1a73e8" />
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permSub}>To scan QR codes for payment</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#5f6368', fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const processQR = async (data: string) => {
    if (isProcessing || success) return;

    try {
      if (data.startsWith('OFFLINE_JWT:')) {
        const parts = data.split(':');
        const amount = parseFloat(parts[1]);
        const jwt = parts.slice(2).join(':');

        if (isNaN(amount) || !jwt) throw new Error('Invalid QR format');

        // ✅ Extract tokenId from JWT
        let tokenId = jwt;
        try {
          const payload = JSON.parse(atob(jwt.split('.')[1]));
          tokenId = payload.jti || payload.nonce || jwt;
        } catch (_) {}

        // ✅ Check if this token was already scanned in this session
        if (scannedTokens.current.has(tokenId)) {
          Alert.alert('⚠️ Already Scanned', 'This QR code has already been used.');
          return;
        }

        // ✅ Check if token was already settled in database
        const usedTokens = await AsyncStorage.getItem('USED_TOKEN_IDS');
        const usedArr: string[] = usedTokens ? JSON.parse(usedTokens) : [];
        if (usedArr.includes(tokenId)) {
          Alert.alert('❌ Invalid QR', 'This payment has already been received.');
          return;
        }

        setIsProcessing(true);

        Alert.alert(
          '💸 Incoming Payment',
          `Accept ₹${amount.toFixed(2)}?`,
          [
            {
              text: 'Reject', style: 'cancel',
              onPress: () => setIsProcessing(false)
            },
            {
              text: 'Accept ✅',
              onPress: async () => {
                // ✅ Mark token as used immediately — prevents double scan
                scannedTokens.current.add(tokenId);
                usedArr.push(tokenId);
                await AsyncStorage.setItem('USED_TOKEN_IDS', JSON.stringify(usedArr));

                // Update local balance
                const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
                const newBal = (balStr ? parseFloat(balStr) : 0) + amount;
                await AsyncStorage.setItem('OFFLINE_VAULT_BALANCE', newBal.toString());

                // Log transaction
                const txId = Date.now().toString();
                const tx = {
                  id: txId, type: 'receive', amount, settled: false,
                  date: new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
                };
                const hist = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
                const arr = hist ? JSON.parse(hist) : [];
                arr.unshift(tx);
                await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(arr));

                const receiverId = await AsyncStorage.getItem('USER_ID') || '';

                // Try settle immediately, queue if offline
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
                setIsProcessing(false);
              }
            }
          ]
        );
      } else {
        Alert.alert('Invalid QR', 'This is not an Offline UPI payment code.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color="#188038" />
        </View>
        <Text style={styles.successTitle}>Payment Received!</Text>
        <Text style={styles.successAmount}>₹ {receivedAmount.toFixed(2)}</Text>
        <Text style={styles.successSub}>Added to your Offline Vault</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={isProcessing ? undefined : ({ data }) => processQR(data)}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.scanTitle}>Scan to Receive</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        <View style={styles.bottomBar}>
          {isProcessing
            ? <ActivityIndicator size="large" color="#fff" />
            : <Text style={styles.scanHint}>Point camera at the sender's QR code</Text>
          }
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 20 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  viewfinderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewfinder: { width: 240, height: 240, position: 'relative' },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: '#fff', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  bottomBar: { paddingBottom: 60, alignItems: 'center' },
  scanHint: { color: '#fff', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  permissionScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  permTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginTop: 16, marginBottom: 8 },
  permSub: { fontSize: 14, color: '#5f6368', marginBottom: 28, textAlign: 'center' },
  permBtn: { backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#202124', marginBottom: 8 },
  successAmount: { fontSize: 48, fontWeight: '900', color: '#188038', marginBottom: 8 },
  successSub: { fontSize: 14, color: '#5f6368', marginBottom: 40 },
  doneBtn: { backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 60 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});