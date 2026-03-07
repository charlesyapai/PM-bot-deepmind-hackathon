import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  Mail,
  HeartPulse,
  HardDrive,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Clock,
  Info,
  CalendarClock,
  FolderOpen,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { typography } from '../theme/typography';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getHousekeeping, HousekeepingResult, HousekeepingItem } from '../services/api';
import { getCacheSize, clearCache, formatBytes } from '../lib/localStorage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RootStackParamList = {
  MainTabs: undefined;
  GoogleSettings: undefined;
};

// ---------------------------------------------------------------------------
// Settings Row Component
// ---------------------------------------------------------------------------

const SettingsRow = ({
  icon,
  label,
  detail,
  onPress,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
}) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
    <View style={styles.rowLeft}>
      {icon}
      <Text
        style={[
          typography.body,
          styles.rowLabel,
          destructive && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </View>
    <View style={styles.rowRight}>
      {detail && (
        <Text style={[typography.caption, { color: colors.textSecondary, marginRight: 8 }]}>
          {detail}
        </Text>
      )}
      <ChevronRight color={colors.textSecondary} size={18} />
    </View>
  </TouchableOpacity>
);

// ---------------------------------------------------------------------------
// Housekeeping Category Icons
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  keyof HousekeepingResult,
  { label: string; icon: React.ReactNode; color: string }
> = {
  overdue_tasks: {
    label: 'Overdue Tasks',
    icon: <AlertTriangle color={colors.danger} size={18} />,
    color: colors.danger,
  },
  stale_projects: {
    label: 'Stale Projects',
    icon: <FolderOpen color={colors.warning} size={18} />,
    color: colors.warning,
  },
  missing_info: {
    label: 'Missing Info',
    icon: <Info color={colors.primary} size={18} />,
    color: colors.primary,
  },
  past_events: {
    label: 'Past Events',
    icon: <Clock color={colors.textSecondary} size={18} />,
    color: colors.textSecondary,
  },
  upcoming_deadlines: {
    label: 'Upcoming Deadlines',
    icon: <CalendarClock color={colors.warning} size={18} />,
    color: colors.warning,
  },
};

// ---------------------------------------------------------------------------
// Settings Screen
// ---------------------------------------------------------------------------

export const SettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Cache state
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  // Housekeeping modal state
  const [showHousekeeping, setShowHousekeeping] = useState(false);
  const [housekeepingData, setHousekeepingData] = useState<HousekeepingResult | null>(null);
  const [housekeepingLoading, setHousekeepingLoading] = useState(false);
  const [housekeepingError, setHousekeepingError] = useState<string | null>(null);

  const loadCacheSize = useCallback(async () => {
    try {
      const size = await getCacheSize();
      setCacheSize(size);
    } catch {
      setCacheSize(0);
    }
  }, []);

  useEffect(() => {
    loadCacheSize();
  }, [loadCacheSize]);

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will remove all cached files and meeting notes. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearingCache(true);
          try {
            await clearCache();
            setCacheSize(0);
            Alert.alert('Done', 'Cache cleared successfully.');
          } catch {
            Alert.alert('Error', 'Failed to clear cache.');
          } finally {
            setClearingCache(false);
          }
        },
      },
    ]);
  };

  const handleOpenHousekeeping = async () => {
    setShowHousekeeping(true);
    setHousekeepingLoading(true);
    setHousekeepingError(null);
    try {
      const data = await getHousekeeping();
      setHousekeepingData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load health check.';
      setHousekeepingError(message);
    } finally {
      setHousekeepingLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  // Compute housekeeping summary
  const housekeepingSummary = housekeepingData
    ? {
        overdue: housekeepingData.overdue_tasks.length,
        attention:
          housekeepingData.stale_projects.length + housekeepingData.missing_info.length,
        upcoming: housekeepingData.upcoming_deadlines.length,
      }
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Google Integration */}
      <View style={styles.section}>
        <Text style={[typography.caption, styles.sectionTitle]}>GOOGLE INTEGRATION</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<Mail color={colors.primary} size={20} />}
            label="Google Account"
            detail="Gmail · Calendar · Drive"
            onPress={() => navigation.navigate('GoogleSettings')}
          />
        </View>
      </View>

      {/* Board */}
      <View style={styles.section}>
        <Text style={[typography.caption, styles.sectionTitle]}>BOARD</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<HeartPulse color={colors.success} size={20} />}
            label="Board Health Check"
            onPress={handleOpenHousekeeping}
          />
          <SettingsRow
            icon={<Clock color={colors.primary} size={20} />}
            label="Board Update History"
            onPress={() => Alert.alert('Coming Soon', 'Board update history is available on the Dashboard.')}
          />
        </View>
      </View>

      {/* Storage */}
      <View style={styles.section}>
        <Text style={[typography.caption, styles.sectionTitle]}>STORAGE</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<HardDrive color={colors.textSecondary} size={20} />}
            label="Clear Cache"
            detail={
              clearingCache
                ? 'Clearing...'
                : cacheSize !== null
                ? `Using ${formatBytes(cacheSize)}`
                : ''
            }
            onPress={handleClearCache}
          />
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={[typography.caption, styles.sectionTitle]}>ACCOUNT</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<LogOut color={colors.danger} size={20} />}
            label="Sign Out"
            onPress={handleSignOut}
            destructive
          />
        </View>
      </View>

      {/* Housekeeping Modal */}
      <Modal
        visible={showHousekeeping}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowHousekeeping(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowHousekeeping(false)}>
              <Text style={[typography.body, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[typography.body, { fontWeight: '600' }]}>Board Health Check</Text>
            <View style={{ width: 40 }} />
          </View>

          {housekeepingLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 12 }]}>
                Analyzing your board...
              </Text>
            </View>
          ) : housekeepingError ? (
            <View style={styles.centered}>
              <Text style={[typography.body, { color: colors.danger, textAlign: 'center' }]}>
                {housekeepingError}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleOpenHousekeeping}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : housekeepingData ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {/* Summary bar */}
              {housekeepingSummary && (
                <View style={styles.summaryBar}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNumber, { color: colors.danger }]}>
                      {housekeepingSummary.overdue}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>overdue</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNumber, { color: colors.warning }]}>
                      {housekeepingSummary.attention}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      need attention
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNumber, { color: colors.primary }]}>
                      {housekeepingSummary.upcoming}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>upcoming</Text>
                  </View>
                </View>
              )}

              {/* Category sections */}
              {(Object.keys(CATEGORY_CONFIG) as Array<keyof HousekeepingResult>).map((key) => {
                const items = housekeepingData[key];
                const config = CATEGORY_CONFIG[key];
                if (items.length === 0) return null;
                return (
                  <View key={key} style={{ marginBottom: 20 }}>
                    <View style={styles.categoryHeader}>
                      {config.icon}
                      <Text
                        style={[
                          typography.body,
                          { fontWeight: '600', marginLeft: 8, color: config.color },
                        ]}
                      >
                        {config.label} ({items.length})
                      </Text>
                    </View>
                    {items.map((item: HousekeepingItem) => (
                      <TouchableOpacity key={item.id} style={styles.housekeepingItem}>
                        <Text style={[typography.body, { fontWeight: '500' }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text
                          style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
                          numberOfLines={1}
                        >
                          {item.detail}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}

              {/* All clear */}
              {Object.values(housekeepingData).every(
                (arr: HousekeepingItem[]) => arr.length === 0
              ) && (
                <View style={styles.centered}>
                  <HeartPulse color={colors.success} size={48} />
                  <Text
                    style={[
                      typography.body,
                      { color: colors.textSecondary, marginTop: 16, textAlign: 'center' },
                    ]}
                  >
                    Your board is healthy! No issues found.
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowLabel: {
    marginLeft: 12,
    fontWeight: '400',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Housekeeping modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  housekeepingItem: {
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
});
