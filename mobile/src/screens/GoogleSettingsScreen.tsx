import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Linking,
} from 'react-native';
import {
  Mail,
  Calendar,
  HardDrive,
  CheckCircle,
  XCircle,
  Clock,
  FolderOpen,
  LogOut,
  ExternalLink,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import {
  getGoogleStatus,
  getGoogleAuthUrl,
  disconnectGoogle,
  GoogleConnection,
} from '../services/api';

// ---------------------------------------------------------------------------
// Google Settings Screen (replaces GmailSettingsScreen)
// ---------------------------------------------------------------------------

export const GoogleSettingsScreen = () => {
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const status = await getGoogleStatus();
      setConnection(status);
    } catch {
      setConnection(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await getGoogleAuthUrl();
      await Linking.openURL(url);
      // After returning from OAuth, refresh status
      setTimeout(() => loadData(true), 2000);
    } catch {
      Alert.alert('Error', 'Failed to start Google sign-in. Make sure the backend has Google OAuth credentials configured.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Google',
      'This will disconnect Gmail, Calendar, and Drive. All synced data remains in the app but will no longer update.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectGoogle();
              setConnection(null);
            } catch {
              Alert.alert('Error', 'Failed to disconnect Google account.');
            }
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const formatTimeAgo = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isConnected = connection?.connected ?? false;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={[typography.caption, styles.sectionTitle]}>GOOGLE ACCOUNT</Text>
        <View style={styles.card}>
          {isConnected ? (
            <>
              <View style={styles.accountRow}>
                <View style={styles.accountAvatar}>
                  <Text style={styles.accountAvatarText}>
                    {(connection?.email ?? 'G')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.accountInfo}>
                  <Text style={[typography.body, { fontWeight: '600' }]}>
                    {connection?.email ?? 'Connected'}
                  </Text>
                  <Text style={[typography.caption, { color: colors.success, marginTop: 2 }]}>
                    Google account connected
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.disconnectRow} onPress={handleDisconnect}>
                <LogOut color={colors.danger} size={16} />
                <Text style={styles.disconnectText}>Disconnect Google Account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.notConnectedContainer}>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }]}>
                Connect your Google account to sync Gmail, Calendar, and Drive with your projects.
              </Text>
              <TouchableOpacity
                style={[styles.connectButton, connecting && { opacity: 0.6 }]}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.connectButtonText}>Connect Google</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Connected Services */}
      {isConnected && (
        <View style={styles.section}>
          <Text style={[typography.caption, styles.sectionTitle]}>CONNECTED SERVICES</Text>
          <View style={styles.card}>
            <ServiceRow
              icon={<Mail color={colors.primary} size={20} />}
              label="Gmail"
              connected={connection?.services.gmail ?? false}
              detail="Read emails, sync rules"
            />
            <View style={styles.serviceDivider} />
            <ServiceRow
              icon={<Calendar color={colors.warning} size={20} />}
              label="Calendar"
              connected={connection?.services.calendar ?? false}
              detail="Two-way event sync"
            />
            <View style={styles.serviceDivider} />
            <ServiceRow
              icon={<HardDrive color={colors.success} size={20} />}
              label="Drive"
              connected={connection?.services.drive ?? false}
              detail="Per-project file folders"
            />
          </View>
        </View>
      )}

      {/* Sync Status */}
      {isConnected && (
        <View style={styles.section}>
          <Text style={[typography.caption, styles.sectionTitle]}>SYNC STATUS</Text>
          <View style={styles.card}>
            <SyncRow
              label="Last email sync"
              value={formatTimeAgo(connection?.last_email_sync ?? null)}
            />
            <View style={styles.serviceDivider} />
            <SyncRow
              label="Last calendar sync"
              value={formatTimeAgo(connection?.last_calendar_sync ?? null)}
            />
            {connection?.drive_root_folder_id && (
              <>
                <View style={styles.serviceDivider} />
                <View style={styles.driveInfoRow}>
                  <FolderOpen color={colors.textSecondary} size={16} />
                  <View style={styles.driveInfoText}>
                    <Text style={[typography.body, { fontSize: 15 }]}>
                      {connection.drive_root_folder_name ?? 'SmoothStream'}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      {connection.drive_project_folder_count} project folder{connection.drive_project_folder_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Info Footer */}
      <View style={styles.footer}>
        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }]}>
          {isConnected
            ? 'Google services sync automatically when you update your board or use voice commands.'
            : 'Your data stays private. Google access can be revoked at any time.'}
        </Text>
      </View>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ServiceRow = ({
  icon,
  label,
  connected,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  connected: boolean;
  detail: string;
}) => (
  <View style={styles.serviceRow}>
    <View style={styles.serviceIcon}>{icon}</View>
    <View style={styles.serviceInfo}>
      <Text style={[typography.body, { fontWeight: '500' }]}>{label}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 1 }]}>{detail}</Text>
    </View>
    {connected ? (
      <View style={styles.statusBadge}>
        <CheckCircle color={colors.success} size={14} />
        <Text style={[styles.statusBadgeText, { color: colors.success }]}>Active</Text>
      </View>
    ) : (
      <View style={styles.statusBadge}>
        <XCircle color={colors.textSecondary} size={14} />
        <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>Inactive</Text>
      </View>
    )}
  </View>
);

const SyncRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.syncRow}>
    <Clock color={colors.textSecondary} size={14} />
    <Text style={[typography.caption, { color: colors.textSecondary, flex: 1, marginLeft: 8 }]}>{label}</Text>
    <Text style={[typography.caption, { fontWeight: '500', color: colors.textPrimary }]}>{value}</Text>
  </View>
);

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
    backgroundColor: colors.backgroundLight,
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
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  // Account
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 14,
  },
  disconnectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 6,
  },
  disconnectText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  notConnectedContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  connectButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  // Services
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  serviceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
    marginLeft: 48,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Sync
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  driveInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  driveInfoText: {
    marginLeft: 8,
  },
  // Footer
  footer: {
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
});
