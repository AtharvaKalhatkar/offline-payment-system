import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, StatusBar, Dimensions, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { settlePending, getPendingCount } from '../../settle';
import BASE_URL from '../../config';

const { width } = Dimensions.get('window');


export default function HomeScreen() {
  const router = useRouter();
  const [offlineBalance, setOfflineBalance] = useState(0);
  const [cloudBalance, setCloudBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [settling, setSettling] = useState(false);
  const [settleResult, setSettleResult] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const name = await AsyncStorage.getItem('USER_NAME');
        const id = await AsyncStorage.getItem('USER_ID');
        const bal = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
        const hist = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
        if (name) setUserName(name);
        if (bal) setOfflineBalance(parseFloat(bal));
        if (hist) setTransactions(JSON.parse(hist).slice(0, 5));
        if (id) {
          setUserId(id);
          try {
            const res = await fetch(`${BASE_URL}/api/users/${id}/balance`);
            if (res.ok) {
              const balance = await res.json();
              setCloudBalance(balance ?? 0);
            }
          } catch (_) {}

          // Auto-settle pending transactions
          const count = await getPendingCount();
          setPendingCount(count);
          if (count > 0) {
            setSettling(true);
            try {
              const result = await settlePending();
              if (result.settled > 0) {
                setSettleResult(`✅ ${result.settled} transaction${result.settled > 1 ? 's' : ''} settled to cloud!`);
                setPendingCount(result.failed);
                // Refresh cloud balance after settlement
                const res2 = await fetch(`${BASE_URL}/api/users/${id}/balance`);
                if (res2.ok) setCloudBalance(await res2.json() ?? 0);
                setTimeout(() => setSettleResult(null), 4000);
              }
            } catch (_) {}
            setSettling(false);
          }
        }
      };
      load();
    }, [])
  );

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const handleLoadWallet = () => {
    if (!userId) {
      Alert.alert(
        'Register First',
        'You need an account before loading the wallet.',
        [
          { text: 'Register Now', onPress: () => router.push('/register' as any) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }
    router.push('/load-wallet' as any);
  };

  const quickActions = [
    { icon: 'qr-code-outline', label: 'Pay QR', route: '/send-qr' },
    { icon: 'scan-outline', label: 'Receive', route: '/receive-qr' },
    { icon: 'bluetooth-outline', label: 'BLE Pay', route: '/send-ble' },
    { icon: 'radio-outline', label: 'BLE Recv', route: '/receive-ble' },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />

      {/* Blue Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good {getGreeting()},</Text>
            <Text style={styles.userName}>{userName || 'User'} 👋</Text>
          </View>
          <View style={styles.headerRight}>
            {/* ✅ Register badge — shows only when not registered */}
            {!userId && (
              <TouchableOpacity
                style={styles.registerBadge}
                onPress={() => router.push('/login' as any)}
              >
                <Ionicons name="person-add-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.registerBadgeText}>Login</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push('/profile' as any)}
            >
              <Text style={styles.avatarText}>{getInitials(userName)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Floating Balance Card — outside header */}
      <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceBlock}>
              <Text style={styles.balLabel}>Offline Vault</Text>
              <Text style={styles.balAmount}>
                {balanceHidden ? '₹ ••••' : `₹ ${offlineBalance.toFixed(2)}`}
              </Text>
            </View>
            <View style={styles.balDivider} />
            <View style={styles.balanceBlock}>
              <Text style={styles.balLabel}>Cloud Balance</Text>
              <Text style={styles.balAmount}>
                {balanceHidden ? '₹ ••••' : `₹ ${cloudBalance.toFixed(2)}`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setBalanceHidden(v => !v)} style={{ padding: 4 }}>
              <Ionicons name={balanceHidden ? 'eye-outline' : 'eye-off-outline'} size={18} color="#5f6368" />
            </TouchableOpacity>
          </View>

          {/* ✅ Load button with register check */}
          <TouchableOpacity style={styles.loadBtn} onPress={handleLoadWallet}>
            <Ionicons name="add-circle-outline" size={18} color="#1a73e8" style={{ marginRight: 6 }} />
            <Text style={styles.loadBtnText}>
              {userId ? 'Load Offline Wallet' : 'Register to Load Wallet'}
            </Text>
          </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {quickActions.map((a, i) => (
            <TouchableOpacity
              key={i} style={styles.actionBtn}
              onPress={() => router.push(a.route as any)}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={a.icon as any} size={26} color="#1a73e8" />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Security Badge */}
        <View style={styles.secBadge}>
          <Ionicons name="shield-checkmark" size={18} color="#1a73e8" />
          <Text style={styles.secText}>RSA-256 signed · JWT secured · Offline ready</Text>
        </View>

        {/* Settlement Banner */}
        {settleResult && (
          <View style={styles.settleBanner}>
            <Ionicons name="cloud-done-outline" size={18} color="#16a34a" />
            <Text style={styles.settleBannerText}>{settleResult}</Text>
          </View>
        )}
        {pendingCount > 0 && !settling && !settleResult && (
          <TouchableOpacity style={styles.pendingBanner} onPress={async () => {
            setSettling(true);
            const result = await settlePending();
            if (result.settled > 0) {
              setSettleResult(`✅ ${result.settled} transaction${result.settled > 1 ? 's' : ''} settled!`);
              setPendingCount(result.failed);
              setTimeout(() => setSettleResult(null), 4000);
            } else {
              Alert.alert('Still Offline', 'Could not reach server. Settlements will retry when online.');
            }
            setSettling(false);
          }}>
            <Ionicons name="cloud-upload-outline" size={18} color="#d97706" />
            <Text style={styles.pendingBannerText}>{pendingCount} pending settlement{pendingCount > 1 ? 's' : ''} · Tap to sync</Text>
            <Ionicons name="chevron-forward" size={14} color="#d97706" />
          </TouchableOpacity>
        )}
        {settling && (
          <View style={styles.settlingBanner}>
            <Ionicons name="sync-outline" size={18} color="#1a73e8" />
            <Text style={styles.settlingText}>Settling transactions...</Text>
          </View>
        )}

        {/* Not registered warning */}
        {!userId && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={() => router.push('/login' as any)}
          >
            <Ionicons name="warning-outline" size={18} color="#f59e0b" />
            <Text style={styles.warningText}>Tap to login and start using Offline UPI</Text>
            <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* Transactions */}
        <View style={styles.histHead}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={52} color="#dadce0" />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySub}>Load your wallet to get started</Text>
          </View>
        ) : (
          transactions.map(item => (
            <View key={item.id} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: item.type === 'send' ? '#fce8e6' : '#e6f4ea' }]}>
                <Ionicons
                  name={item.type === 'send' ? 'arrow-up' : item.type === 'load' ? 'cloud-download' : 'arrow-down'}
                  size={20} color={item.type === 'send' ? '#d93025' : '#188038'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle}>
                  {item.type === 'send' ? 'Sent' : item.type === 'load' ? 'Loaded' : 'Received'}
                </Text>
                <Text style={styles.txDate}>{item.date}</Text>
              </View>
              <Text style={[styles.txAmt, { color: item.type === 'send' ? '#d93025' : '#188038' }]}>
                {item.type === 'send' ? '−' : '+'} ₹{item.amount.toFixed(2)}
              </Text>
            </View>
          ))
        )}

        {/* Reset button */}
        <TouchableOpacity style={styles.resetBtn} onPress={() => {
          Alert.alert(
            '⚠️ Log Out',
            'This will log you out of this device. Your cloud balance and history are safe on the server — just log back in!',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: async () => {
                await AsyncStorage.clear();
                router.replace('/login' as any);
              }},
            ]
          );
        }}>
          <Text style={styles.resetBtnText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { backgroundColor: '#1a73e8', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  userName: { fontSize: 22, color: '#fff', fontWeight: '800', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  registerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  registerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1a73e8', fontSize: 15, fontWeight: '800' },
  balanceCard: { marginHorizontal: 20, marginTop: -10, backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 10, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, zIndex: 10 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  balanceBlock: { flex: 1 },
  balLabel: { fontSize: 11, color: '#5f6368', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  balAmount: { fontSize: 20, fontWeight: '800', color: '#202124' },
  balDivider: { width: 1, height: 38, backgroundColor: '#e8eaed', marginHorizontal: 14 },
  loadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 10, paddingVertical: 10 },
  loadBtnText: { color: '#1a73e8', fontWeight: '700', fontSize: 14 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#202124', marginBottom: 14 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { alignItems: 'center', width: (width - 60) / 4 },
  actionIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 11, color: '#3c4043', fontWeight: '600', textAlign: 'center' },
  secBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f0fe', borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 },
  secText: { fontSize: 12, color: '#1a73e8', fontWeight: '600', flex: 1 },
  settleBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, marginBottom: 12, gap: 8, borderWidth: 1, borderColor: '#86efac' },
  settleBannerText: { flex: 1, fontSize: 13, color: '#16a34a', fontWeight: '600' },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 12, gap: 8, borderWidth: 1, borderColor: '#fcd34d' },
  pendingBannerText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '600' },
  settlingBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginBottom: 12, gap: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  settlingText: { flex: 1, fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 20, gap: 8, borderWidth: 1, borderColor: '#fcd34d' },
  warningText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '600' },
  histHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1 },
  txIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txTitle: { fontSize: 14, fontWeight: '700', color: '#202124' },
  txDate: { fontSize: 12, color: '#5f6368', marginTop: 2 },
  txAmt: { fontSize: 15, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#3c4043', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#5f6368', marginTop: 4 },
  resetBtn: { alignItems: 'center', paddingVertical: 16 },
  resetBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});