import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [offlineBal, setOfflineBal] = useState(0);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setName(await AsyncStorage.getItem('USER_NAME') || '');
      setPhone(await AsyncStorage.getItem('USER_PHONE') || '');
      setUserId(await AsyncStorage.getItem('USER_ID') || '');
      const bal = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
      if (bal) setOfflineBal(parseFloat(bal));
    };
    load();
  }, []));

  const getInitials = (n: string) => n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const handleLogout = () => {
    Alert.alert('Log Out', 'You will be logged out of this device. Your cloud balance is safe!', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        await AsyncStorage.clear();
        router.replace('/login' as any);
      }},
    ]);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          <Text style={styles.nameText}>{name || 'User'}</Text>
          <Text style={styles.phoneText}>{phone || 'No phone registered'}</Text>
        </View>

        {/* Info Cards */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="wallet-outline" size={20} color="#1a73e8" />
            <Text style={styles.cardLabel}>Offline Vault Balance</Text>
            <Text style={styles.cardValue}>₹{offlineBal.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardRow}>
            <Ionicons name="finger-print-outline" size={20} color="#1a73e8" />
            <Text style={styles.cardLabel}>User ID</Text>
            <Text style={styles.cardValueSmall} numberOfLines={1}>{userId ? userId.slice(0, 16) + '...' : '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#16a34a" />
            <Text style={styles.cardLabel}>Security</Text>
            <Text style={[styles.cardValue, { color: '#16a34a' }]}>RSA-256 + JWT</Text>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/load-wallet' as any)}>
          <Ionicons name="add-circle-outline" size={22} color="#1a73e8" />
          <Text style={styles.actionText}>Load Offline Wallet</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/register' as any)}>
          <Ionicons name="create-outline" size={22} color="#1a73e8" />
          <Text style={styles.actionText}>Edit Account</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionRow, { borderColor: '#fca5a5' }]} onPress={handleLogout}>
          <Ionicons name="trash-outline" size={22} color="#dc2626" />
          <Text style={[styles.actionText, { color: '#dc2626' }]}>Reset All Data</Text>
          <Ionicons name="chevron-forward" size={18} color="#fca5a5" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { backgroundColor: '#1a73e8', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { padding: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center', marginBottom: 14, elevation: 6 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  nameText: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 4 },
  phoneText: { fontSize: 14, color: '#5f6368' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 4, marginBottom: 16, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardLabel: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' },
  cardValue: { fontSize: 14, fontWeight: '700', color: '#202124' },
  cardValueSmall: { fontSize: 12, fontWeight: '600', color: '#6b7280', maxWidth: 120 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: '#e8eaed', elevation: 1 },
  actionText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#202124' },
});