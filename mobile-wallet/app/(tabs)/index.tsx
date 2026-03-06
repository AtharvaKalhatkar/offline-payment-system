import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const [offlineBalance, setOfflineBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          const savedBalance = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
          if (savedBalance !== null) setOfflineBalance(parseFloat(savedBalance));

          const historyStr = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
          if (historyStr !== null) setTransactions(JSON.parse(historyStr));
        } catch (e) {
          console.log("Failed to load data");
        }
      };
      fetchData();
    }, [])
  );

  const handleLoadWallet = () => {
    // This is the bridge to your Spring Boot Backend
    Alert.alert(
      "Backend Required",
      "To load the offline vault, the app needs to connect to your Spring Boot server to sign a JWT. Run the server on your other laptop to enable this!",
      [{ text: "Understood" }]
    );
  };

  const renderTransaction = ({ item }: any) => (
    <View style={styles.transactionRow}>
      <View style={styles.transactionLeft}>
        <View style={styles.iconCircle}>
          <Ionicons 
            name={item.type === 'receive' ? "arrow-down-circle" : "arrow-up-circle"} 
            size={36} 
            color={item.type === 'receive' ? "#16a34a" : "#ef4444"} 
          />
        </View>
        <View>
          <Text style={styles.transactionTitle}>
            {item.type === 'receive' ? "Received Offline" : "Sent Offline"}
          </Text>
          <Text style={styles.transactionDate}>{item.date}</Text>
        </View>
      </View>
      <Text style={[styles.transactionAmount, { color: item.type === 'receive' ? "#16a34a" : "#ef4444" }]}>
        {item.type === 'receive' ? "+" : "-"} ₹{item.amount.toFixed(2)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with Offline Status */}
      <View style={styles.header}>
        <Text style={styles.title}>Offline UPI</Text>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Local Vault Active</Text>
        </View>
      </View>
      
      {/* Cloud Balance Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.balanceLabel}>Cloud Balance</Text>
          <Ionicons name="cloud-done-outline" size={16} color="#6b7280" />
        </View>
        <Text style={styles.balanceAmount}>₹ 5,000.00</Text>
      </View>

      {/* Offline Vault Card */}
      <View style={[styles.card, styles.offlineCard]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.balanceLabel, {color: '#0369a1'}]}>Offline Vault (JWT)</Text>
          <Ionicons name="shield-checkmark" size={16} color="#0369a1" />
        </View>
        <Text style={styles.balanceAmount}>₹ {offlineBalance.toFixed(2)}</Text>
      </View>

      <TouchableOpacity style={styles.mainButton} onPress={handleLoadWallet}>
        <Ionicons name="download-outline" size={20} color="#fff" style={{marginRight: 8}} />
        <Text style={styles.mainButtonText}>Load Offline Wallet</Text>
      </TouchableOpacity>

      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Recent Activity</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          <FlatList 
            data={transactions}
            keyExtractor={(item: any) => item.id}
            renderItem={renderTransaction}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>

      <TouchableOpacity 
        style={styles.resetButton} 
        onPress={() => {
          Alert.alert("Reset Data", "Clear all offline balances and history?", [
            { text: "Cancel", style: "cancel" },
            { text: "Reset", style: "destructive", onPress: async () => {
                await AsyncStorage.clear();
                setOfflineBalance(0);
                setTransactions([]);
            }}
          ]);
        }}
      >
        <Text style={styles.resetButtonText}>Reset All Data</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f5', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a', marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#16a34a' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  card: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  offlineCard: { backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#7dd3fc' },
  balanceLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', color: '#111827' },
  mainButton: { backgroundColor: '#2563eb', flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  mainButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  historySection: { flex: 1 },
  historyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10 },
  transactionLeft: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { marginRight: 12 },
  transactionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  transactionDate: { fontSize: 12, color: '#6b7280' },
  transactionAmount: { fontSize: 16, fontWeight: '800' },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', marginTop: 10 },
  resetButton: { paddingVertical: 20, alignItems: 'center' },
  resetButtonText: { color: '#ef4444', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }
});