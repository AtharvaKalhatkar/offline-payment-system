// Settlement Service
// Automatically settles pending offline transactions when back online

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.77.98.11:8082';

export interface PendingSettlement {
  id: string;
  tokenId: string;       // JWT nonce — used as tokenId on backend
  receiverId: string;    // who received the money
  amount: number;
  date: string;
  type: 'send' | 'receive';
}

// Call this after every QR/BLE send to queue settlement
export async function queueSettlement(settlement: PendingSettlement) {
  const raw = await AsyncStorage.getItem('PENDING_SETTLEMENTS');
  const arr: PendingSettlement[] = raw ? JSON.parse(raw) : [];
  arr.push(settlement);
  await AsyncStorage.setItem('PENDING_SETTLEMENTS', JSON.stringify(arr));
}

// Call this on home screen focus — tries to settle all pending txs
export async function settlePending(): Promise<{
  settled: number;
  failed: number;
  total: number;
}> {
  const raw = await AsyncStorage.getItem('PENDING_SETTLEMENTS');
  if (!raw) return { settled: 0, failed: 0, total: 0 };

  const pending: PendingSettlement[] = JSON.parse(raw);
  if (pending.length === 0) return { settled: 0, failed: 0, total: 0 };

  const remaining: PendingSettlement[] = [];
  let settled = 0;
  let failed = 0;

  for (const tx of pending) {
    try {
      const res = await fetch(`${BASE_URL}/api/wallet/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: tx.receiverId,
          tokenId: tx.tokenId,
        }),
      });

      if (res.ok) {
        settled++;
        // Mark as settled in transaction history
        await markTxSettled(tx.id);
      } else {
        const text = await res.text();
        // Token already spent — remove from queue
        if (text.includes('already spent') || text.includes('Invalid Token')) {
          settled++; // treat as done
        } else {
          remaining.push(tx); // retry later
          failed++;
        }
      }
    } catch (_) {
      // Offline — keep in queue
      remaining.push(tx);
      failed++;
    }
  }

  await AsyncStorage.setItem('PENDING_SETTLEMENTS', JSON.stringify(remaining));
  return { settled, failed, total: pending.length };
}

async function markTxSettled(txId: string) {
  const raw = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
  if (!raw) return;
  const txs = JSON.parse(raw);
  const updated = txs.map((tx: any) =>
    tx.id === txId ? { ...tx, settled: true } : tx
  );
  await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(updated));
}

export async function getPendingCount(): Promise<number> {
  const raw = await AsyncStorage.getItem('PENDING_SETTLEMENTS');
  if (!raw) return 0;
  return JSON.parse(raw).length;
}