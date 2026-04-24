import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

// ─── Config ──────────────────────────────────────────────────────────────────
const USE_MOCK = true; // ← flip to false when RevenueCat is ready
const MOCK_STATE: 'free' | 'trial' | 'subscribed' = 'free'; // ← change to test different states
const FREE_JOIN_LIMIT = 15;
const RC_USER_ID_KEY = 'rc_user_id_cache';
const SERVER_URL = 'https://musictalk-production.up.railway.app';

// ─── Types ───────────────────────────────────────────────────────────────────
export type SubscriptionStatus = 'loading' | 'free' | 'trial' | 'subscribed';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  hasProAccess: boolean;
  isInTrial: boolean;
}

export interface JoinResult {
  allowed: boolean;
  remaining: number;
  joinCount: number;
  isNewRoom: boolean;
  limitReached: boolean;
}

// ─── RC User ID (with AsyncStorage cache + device ID fallback) ───────────────
export async function getRcUserId(): Promise<string> {
  try {
    // 1. Try AsyncStorage cache first
    const cached = await AsyncStorage.getItem(RC_USER_ID_KEY);
    if (cached) return cached;

    if (USE_MOCK) {
      // In mock mode, generate a stable fake ID
      const mockId = 'mock_' + (await getDeviceId());
      await AsyncStorage.setItem(RC_USER_ID_KEY, mockId);
      return mockId;
    }

    // 2. Try RevenueCat anonymous ID (real mode only)
    const Purchases = require('react-native-purchases').default;
    const info = await Purchases.getCustomerInfo();
    const rcId = info.originalAppUserId;
    await AsyncStorage.setItem(RC_USER_ID_KEY, rcId);
    return rcId;

  } catch (err) {
    // 3. Fallback to device ID
    console.warn('getRcUserId fallback to device ID:', err);
    return await getDeviceId();
  }
}

async function getDeviceId(): Promise<string> {
  try {
    const id = await Application.getAndroidId();
    return id ?? 'unknown_device_' + Math.random().toString(36).substring(2, 10);
  } catch {
    return 'unknown_device_' + Math.random().toString(36).substring(2, 10);
  }
}

// ─── Subscription status ─────────────────────────────────────────────────────
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  if (USE_MOCK) {
    return {
      status: MOCK_STATE,
      hasProAccess: MOCK_STATE === 'trial' || MOCK_STATE === 'subscribed',
      isInTrial: MOCK_STATE === 'trial',
    };
  }

  try {
    const Purchases = require('react-native-purchases').default;
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active['pro_access'];

    if (!entitlement) {
      return { status: 'free', hasProAccess: false, isInTrial: false };
    }

    const isInTrial = entitlement.periodType === 'TRIAL';
    return {
      status: isInTrial ? 'trial' : 'subscribed',
      hasProAccess: true,
      isInTrial,
    };
  } catch (err) {
    console.error('getSubscriptionInfo error:', err);
    // Fail open
    return { status: 'free', hasProAccess: false, isInTrial: false };
  }
}

// ─── Record a join attempt ───────────────────────────────────────────────────
export async function recordJoin(roomId: string): Promise<JoinResult> {
  try {
    const rcUserId = await getRcUserId();

    const response = await fetch(`${SERVER_URL}/record-join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rc_user_id: rcUserId, room_id: roomId }),
    });

    const data = await response.json();

    return {
      allowed: data.allowed ?? true,
      remaining: data.remaining ?? FREE_JOIN_LIMIT,
      joinCount: data.join_count ?? 0,
      isNewRoom: data.new_room ?? false,
      limitReached: !data.allowed,
    };
  } catch (err) {
    console.error('recordJoin error:', err);
    // Fail open — never block due to network error
    return {
      allowed: true,
      remaining: FREE_JOIN_LIMIT,
      joinCount: 0,
      isNewRoom: false,
      limitReached: false,
    };
  }
}

// ─── Get current join status ─────────────────────────────────────────────────
export async function getJoinStatus(): Promise<{
  joinCount: number;
  remaining: number;
  limitReached: boolean;
}> {
  try {
    const rcUserId = await getRcUserId();
    const response = await fetch(
      `${SERVER_URL}/join-status?rc_user_id=${encodeURIComponent(rcUserId)}`
    );
    const data = await response.json();

    return {
      joinCount: data.join_count ?? 0,
      remaining: data.remaining ?? FREE_JOIN_LIMIT,
      limitReached: data.limit_reached ?? false,
    };
  } catch (err) {
    console.error('getJoinStatus error:', err);
    // Fail open
    return { joinCount: 0, remaining: FREE_JOIN_LIMIT, limitReached: false };
  }
}

// ─── Generate a unique request ID for idempotency ────────────────────────────
function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
}

// ─── Get current create status ───────────────────────────────────────────────
export async function getCreateStatus(): Promise<{
  createCount: number;
  remaining: number;
  limitReached: boolean;
}> {
  try {
    const rcUserId = await getRcUserId();
    const response = await fetch(
      `${SERVER_URL}/create-status?rc_user_id=${encodeURIComponent(rcUserId)}`
    );
    const data = await response.json();
    return {
      createCount: data.create_count ?? 0,
      remaining: data.remaining ?? 2,
      limitReached: data.limit_reached ?? false,
    };
  } catch (err) {
    console.error('getCreateStatus error:', err);
    // Fail open — read local fallback
    const local = await getLocalCreateCount();
    return {
      createCount: local,
      remaining: Math.max(0, 2 - local),
      limitReached: local >= 2,
    };
  }
}

// ─── Record a create attempt ──────────────────────────────────────────────────
export async function recordCreate(): Promise<{
  allowed: boolean;
  createCount: number;
  remaining: number;
}> {
  const requestId = generateRequestId();
  try {
    const rcUserId = await getRcUserId();
    const response = await fetch(`${SERVER_URL}/record-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rc_user_id: rcUserId, request_id: requestId }),
    });
    const data = await response.json();

    // Sync local fallback counter with server value
    if (data.create_count !== undefined) {
      await setLocalCreateCount(data.create_count);
    }

    return {
      allowed: data.allowed ?? true,
      createCount: data.create_count ?? 0,
      remaining: data.remaining ?? 2,
    };
  } catch (err) {
    console.error('recordCreate error:', err);
    // Fail open with local fallback
    const local = await getLocalCreateCount();
    if (local >= 2) {
      return { allowed: false, createCount: local, remaining: 0 };
    }
    const newLocal = local + 1;
    await setLocalCreateCount(newLocal);
    return {
      allowed: true,
      createCount: newLocal,
      remaining: Math.max(0, 2 - newLocal),
    };
  }
}

// ─── Local create count fallback (AsyncStorage) ───────────────────────────────
const LOCAL_CREATE_COUNT_KEY = 'local_create_count';

async function getLocalCreateCount(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(LOCAL_CREATE_COUNT_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

async function setLocalCreateCount(count: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_CREATE_COUNT_KEY, String(count));
  } catch {}
}

// ─── Initialize RevenueCat (call once at app startup) ────────────────────────
export async function initializeSubscriptions(): Promise<void> {
  if (USE_MOCK) return; // No-op in mock mode

  try {
    const Purchases = require('react-native-purchases').default;
    Purchases.configure({
      apiKey: 'goog_YOUR_KEY_HERE', // ← replace when RevenueCat is set up
    });
  } catch (err) {
    console.error('initializeSubscriptions error:', err);
  }
}