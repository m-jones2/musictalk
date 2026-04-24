import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const C = {
  bg: '#0f0f0f',
  card: '#1a1a1a',
  green: '#1DB954',
  white: '#ffffff',
  secondary: '#888888',
  border: '#2a2a2a',
  darkGreen: '#0a3d1e',
};

const PRIVACY_POLICY_URL = 'https://m-jones2.github.io/musictalk/privacy-policy';

const FEATURES = [
  { icon: '🎙', label: 'Create unlimited voice rooms' },
  { icon: '🎧', label: 'Join unlimited rooms every month' },
  { icon: '🔊', label: 'High-quality audio streaming' },
  { icon: '🌐', label: 'Connect with friends worldwide' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const reason = params.reason as string;

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [priceString] = useState('$3.00/month');

  const isJoinLimit = reason === 'join_limit';

  const headerMessage = isJoinLimit
    ? "You've used all 15 free joins this month"
    : 'Create your own rooms with Pro';

  const subMessage = isJoinLimit
    ? 'Create your own rooms and join unlimited with Pro.'
    : 'Upgrade to create unlimited rooms and join as many as you want.';

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      // Mock purchase — replace with real RevenueCat call when ready
      // const Purchases = require('react-native-purchases').default;
      // const offerings = await Purchases.getOfferings();
      // const pkg = offerings.current?.monthly;
      // if (pkg) await Purchases.purchasePackage(pkg);

      // Simulate a short delay for mock
      await new Promise(resolve => setTimeout(resolve, 1500));

      Alert.alert(
        'Mock Purchase',
        'In production this will open Google Play. Mock mode is active.',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase Failed', e.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      // Mock restore — replace with real RevenueCat call when ready
      // const Purchases = require('react-native-purchases').default;
      // const customerInfo = await Purchases.restorePurchases();

      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert(
        'Mock Restore',
        'In production this will restore your Google Play purchase. Mock mode is active.',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message ?? 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Close button — only shown if navigated from join limit, not create */}
        {isJoinLimit && (
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoGlyph}>♫</Text>
          </View>
          <Text style={styles.title}>SoundZone Pro</Text>
          <Text style={styles.headerMessage}>{headerMessage}</Text>
          <Text style={styles.subMessage}>{subMessage}</Text>
        </View>

        {/* Trial badge */}
        <View style={styles.trialBadge}>
          <Text style={styles.trialBadgeText}>✦ 14-DAY FREE TRIAL INCLUDED</Text>
        </View>

        {/* Feature list — compact */}
        <View style={styles.featureCard}>
          {FEATURES.map((f, i) => (
            <View
              key={i}
              style={[
                styles.featureRow,
                i < FEATURES.length - 1 && styles.featureRowBorder,
              ]}
            >
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureCheck}>✓</Text>
            </View>
          ))}
          {/* Pricing inline at bottom of card */}
          <View style={styles.pricingInline}>
            <Text style={styles.pricingNote}>After free trial · Billed monthly · Cancel anytime</Text>
            <Text style={styles.pricingAmount}>{priceString}</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaButton, purchasing && styles.ctaButtonDisabled]}
          onPress={handleSubscribe}
          disabled={purchasing || restoring}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator color={C.bg} size="small" />
          ) : (
            <>
              <Text style={styles.ctaText}>Start Free Trial</Text>
              <Text style={styles.ctaSubtext}>Then {priceString}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Restore */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing || restoring}
        >
          {restoring ? (
            <ActivityIndicator color={C.secondary} size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        {/* Legal */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legalDisclaimer}>
          Subscription automatically renews unless cancelled at least 24 hours
          before the end of the current period. Manage or cancel in Google Play
          subscriptions.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
  },
  closeButtonText: {
    color: C.secondary,
    fontSize: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoGlyph: {
    fontSize: 34,
    color: C.bg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  headerMessage: {
    fontSize: 16,
    color: C.white,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  subMessage: {
    fontSize: 14,
    color: C.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  trialBadge: {
    backgroundColor: '#1a2e1f',
    borderColor: C.green,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 16,
  },
  trialBadgeText: {
    color: C.green,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  featureCard: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  featureRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 14,
    width: 28,
    textAlign: 'center',
  },
  pricingInline: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 4,
  },
  featureLabel: {
    flex: 1,
    fontSize: 15,
    color: C.white,
  },
  featureCheck: {
    color: C.green,
    fontSize: 16,
    fontWeight: '700',
  },
  pricingAmount: {
    fontSize: 17,
    color: C.white,
    fontWeight: '700',
  },
  pricingNote: {
    fontSize: 12,
    color: C.secondary,
    textAlign: 'center',
  },
  ctaButton: {
    width: '100%',
    backgroundColor: C.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 60,
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: C.bg,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ctaSubtext: {
    color: C.darkGreen,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  restoreText: {
    color: C.secondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  legalLink: {
    color: C.secondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDisclaimer: {
    fontSize: 11,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});