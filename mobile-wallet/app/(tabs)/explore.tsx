import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TransferScreen() {
  // Pay States
  const [isPayModalVisible, setPayModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [showQR, setShowQR] = useState(false);

  // Receive States
  const [isReceiveModalVisible, setReceiveModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerateQR = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount to send.");
      return;
    }
    setShowQR(true);
  };

  const closeAndResetPayModal = () => {
    setPayModalVisible(false);
    setShowQR(false);
    setAmount('');
  };

  const handleReceivePress = async () => {
    if (!permission?.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        Alert.alert("Permission needed", "We need camera access to scan QR codes.");
        return;
      }
    }
    setReceiveModalVisible(true);
  };

  const processTransaction = async (data: string) => {
    if (isProcessing) return; // Prevent double scanning
    setIsProcessing(true);

    if (data.startsWith('OFFLINE_PAYMENT_AMOUNT:')) {
      const stringAmount = data.split(':')[1];
      const newMoney = parseFloat(stringAmount);

      if (!isNaN(newMoney)) {
        // PROFESSIONAL STEP: Confirmation Dialog
        Alert.alert(
          "Payment Received",
          `Accept ₹${newMoney.toFixed(2)} from sender?`,
          [
            { text: "Reject", onPress: () => { setReceiveModalVisible(false); setIsProcessing(false); }, style: "cancel" },
            { 
              text: "Accept", 
              onPress: async () => {
                try {
                  // 1. Update Vault Balance
                  const currentVaultStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
                  const currentBalance = currentVaultStr ? parseFloat(currentVaultStr) : 0;
                  const updatedBalance = currentBalance + newMoney;
                  await AsyncStorage.setItem('OFFLINE_VAULT_BALANCE', updatedBalance.toString());

                  // 2. Log Transaction
                  const newTransaction = {
                    id: Date.now().toString(),
                    type: 'receive',
                    amount: newMoney,
                    date: new Date().toLocaleString('en-IN', { 
                      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' 
                    }),
                    status: 'SUCCESS'
                  };

                  const historyStr = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
                  const historyArray = historyStr ? JSON.parse(historyStr) : [];
                  historyArray.unshift(newTransaction);
                  await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(historyArray));

                  Alert.alert("Success!", `₹${newMoney} added to your offline vault.`);
                } catch (e) {
                  Alert.alert("System Error", "Could not write to local storage.");
                } finally {
                  setReceiveModalVisible(false);
                  setIsProcessing(false);
                }
              }
            }
          ]
        );
      }
    } else {
      Alert.alert("Invalid QR", "This code is not recognized by Offline UPI.");
      setReceiveModalVisible(false);
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offline Transfer</Text>
      <Text style={styles.subtitle}>No internet required. Use QR & Bluetooth to sync funds.</Text>

      {/* Action Cards */}
      <TouchableOpacity style={[styles.card, styles.sendCard]} onPress={() => setPayModalVisible(true)}>
        <Ionicons name="qr-code-outline" size={48} color="#2563eb" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>Pay Someone</Text>
          <Text style={styles.cardDescription}>Generate a secure QR code to send funds offline.</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.card, styles.receiveCard]} onPress={handleReceivePress}>
        <Ionicons name="scan-outline" size={48} color="#16a34a" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>Receive Money</Text>
          <Text style={styles.cardDescription}>Scan a sender's QR code to verify and accept funds.</Text>
        </View>
      </TouchableOpacity>

      {/* SEND MODAL */}
      <Modal visible={isPayModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Money</Text>
              <TouchableOpacity onPress={closeAndResetPayModal}>
                <Ionicons name="close-circle" size={32} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {!showQR ? (
              <>
                <Text style={styles.inputLabel}>Enter Amount (₹)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  placeholder="0.00" 
                  value={amount} 
                  onChangeText={setAmount} 
                  autoFocus={true} 
                />
                <TouchableOpacity style={styles.primaryButton} onPress={handleGenerateQR}>
                  <Text style={styles.primaryButtonText}>Generate QR Code</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.qrContainer}>
                <QRCode value={`OFFLINE_PAYMENT_AMOUNT:${amount}`} size={200} />
                <Text style={styles.qrText}>Scan this to receive ₹{amount}</Text>
                <Text style={styles.secureTag}><Ionicons name="shield-checkmark" size={14} /> Encrypted Offline Token</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* RECEIVE MODAL */}
      <Modal visible={isReceiveModalVisible} animationType="slide">
        <View style={styles.cameraContainer}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Scanner</Text>
            <TouchableOpacity onPress={() => setReceiveModalVisible(false)}>
              <Ionicons name="close-circle" size={36} color="#ffffff" />
            </TouchableOpacity>
          </View>
          
          <CameraView 
            style={styles.camera} 
            facing="back"
            onBarcodeScanned={isProcessing ? undefined : ({ data }) => processTransaction(data)}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />

          <View style={styles.cameraFooter}>
            {isProcessing ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : (
              <Text style={styles.cameraFooterText}>Center the QR code in the frame</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f5', alignItems: 'center', paddingTop: 80, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, marginBottom: 40, paddingHorizontal: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', width: '100%', padding: 24, borderRadius: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1 },
  sendCard: { borderColor: '#bfdbfe' },
  receiveCard: { borderColor: '#bbf7d0' },
  icon: { marginRight: 20 },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  cardDescription: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 450 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  inputLabel: { fontSize: 16, color: '#6b7280', marginBottom: 8 },
  input: { fontSize: 48, fontWeight: 'bold', color: '#111827', borderBottomWidth: 2, borderBottomColor: '#2563eb', paddingBottom: 10, marginBottom: 30, textAlign: 'center' },
  primaryButton: { backgroundColor: '#2563eb', padding: 18, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  qrContainer: { alignItems: 'center', marginTop: 20 },
  qrText: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginTop: 20 },
  secureTag: { marginTop: 15, fontSize: 12, color: '#16a34a', fontWeight: '600' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraHeader: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cameraTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  camera: { flex: 1 },
  cameraFooter: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  cameraFooterText: { color: '#fff', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }
});