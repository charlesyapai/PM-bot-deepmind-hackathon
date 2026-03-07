import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Mail, Plus, Trash2, RefreshCw, ExternalLink } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import {
  getGmailStatus,
  connectGmail,
  disconnectGmail,
  getEmailRules,
  createEmailRule,
  deleteEmailRule,
  getImportedEmails,
  syncGmailNow,
  createTaskFromEmail,
  GmailConnection,
  EmailRule,
  ImportedEmail,
} from '../services/api';

// ---------------------------------------------------------------------------
// Gmail Settings Screen
// ---------------------------------------------------------------------------

export const GmailSettingsScreen = () => {
  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [emails, setEmails] = useState<ImportedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add rule modal state
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleSender, setRuleSender] = useState('');
  const [ruleLabel, setRuleLabel] = useState('');
  const [addingRule, setAddingRule] = useState(false);

  // Email detail modal state
  const [selectedEmail, setSelectedEmail] = useState<ImportedEmail | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [status, ruleData, emailData] = await Promise.all([
        getGmailStatus(),
        getEmailRules().catch(() => [] as EmailRule[]),
        getImportedEmails().catch(() => [] as ImportedEmail[]),
      ]);
      setConnection(status);
      setRules(ruleData);
      setEmails(emailData);
    } catch {
      // Status fetch failed - assume disconnected
      setConnection({ connected: false, email: null });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    // In a real implementation, this would use expo-auth-session to get an auth code.
    // For now, show a placeholder alert.
    Alert.alert(
      'Connect Gmail',
      'Google OAuth will open in the browser. After authorizing, the app will receive an auth code automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              // Placeholder: In production, use AuthSession.useAuthRequest
              // const result = await AuthSession.startAsync({ authUrl: '...' });
              // const code = result.params.code;
              // await connectGmail(code);
              Alert.alert('Info', 'OAuth flow not yet configured. Set GOOGLE_CLIENT_ID in app.json to enable.');
            } catch {
              Alert.alert('Error', 'Failed to connect Gmail.');
            }
          },
        },
      ]
    );
  };

  const handleDisconnect = async () => {
    Alert.alert('Disconnect Gmail', 'This will remove your Gmail connection. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await disconnectGmail();
            setConnection({ connected: false, email: null });
            setRules([]);
            setEmails([]);
          } catch {
            Alert.alert('Error', 'Failed to disconnect Gmail.');
          }
        },
      },
    ]);
  };

  const handleAddRule = async () => {
    if (!ruleName.trim()) {
      Alert.alert('Error', 'Please enter a rule name.');
      return;
    }
    setAddingRule(true);
    try {
      const rule = await createEmailRule({
        name: ruleName.trim(),
        sender_filter: ruleSender.trim() || undefined,
        label_filter: ruleLabel.trim() || undefined,
      });
      setRules((prev) => [rule, ...prev]);
      setShowAddRule(false);
      setRuleName('');
      setRuleSender('');
      setRuleLabel('');
    } catch {
      Alert.alert('Error', 'Failed to create rule.');
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = (id: string) => {
    Alert.alert('Delete Rule', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEmailRule(id);
            setRules((prev) => prev.filter((r) => r.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to delete rule.');
          }
        },
      },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncGmailNow();
      Alert.alert('Sync Complete', `Imported ${result.count} new emails.`);
      loadData(true);
    } catch {
      Alert.alert('Error', 'Failed to sync emails.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTaskFromEmail = async (emailId: string) => {
    setCreatingTask(true);
    try {
      await createTaskFromEmail(emailId);
      Alert.alert('Success', 'Task created from email.');
      setSelectedEmail(null);
    } catch {
      Alert.alert('Error', 'Failed to create task from email.');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={[typography.caption, styles.sectionTitle]}>CONNECTION</Text>
        <View style={styles.card}>
          <View style={styles.connectionRow}>
            <Mail color={connection?.connected ? colors.success : colors.textSecondary} size={24} />
            <View style={styles.connectionInfo}>
              <Text style={[typography.body, styles.connectionLabel]}>
                {connection?.connected ? 'Connected' : 'Not Connected'}
              </Text>
              {connection?.email && (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {connection.email}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.connectionButton, connection?.connected && styles.disconnectButton]}
              onPress={connection?.connected ? handleDisconnect : handleConnect}
            >
              <Text
                style={[
                  styles.connectionButtonText,
                  connection?.connected && styles.disconnectButtonText,
                ]}
              >
                {connection?.connected ? 'Disconnect' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Email Rules */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.caption, styles.sectionTitle]}>EMAIL RULES</Text>
          <TouchableOpacity onPress={() => setShowAddRule(true)}>
            <Plus color={colors.primary} size={20} />
          </TouchableOpacity>
        </View>
        {rules.length === 0 ? (
          <View style={styles.card}>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 }]}>
              No email rules yet. Tap + to add one.
            </Text>
          </View>
        ) : (
          rules.map((rule) => (
            <View key={rule.id} style={styles.ruleCard}>
              <View style={styles.ruleInfo}>
                <Text style={[typography.body, { fontWeight: '500' }]}>{rule.name}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {[
                    rule.sender_filter && `From: ${rule.sender_filter}`,
                    rule.label_filter && `Label: ${rule.label_filter}`,
                  ]
                    .filter(Boolean)
                    .join(' | ') || 'No filters'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteRule(rule.id)} hitSlop={8}>
                <Trash2 color={colors.danger} size={18} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Recent Emails */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.caption, styles.sectionTitle]}>IMPORTED EMAILS</Text>
          <TouchableOpacity onPress={handleSync} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <RefreshCw color={colors.primary} size={18} />
            )}
          </TouchableOpacity>
        </View>
        {emails.length === 0 ? (
          <View style={styles.card}>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 }]}>
              No imported emails yet. Connect Gmail and sync to get started.
            </Text>
          </View>
        ) : (
          emails.map((email) => (
            <TouchableOpacity
              key={email.id}
              style={styles.emailCard}
              onPress={() => setSelectedEmail(email)}
              activeOpacity={0.7}
            >
              <View style={styles.emailHeader}>
                <Text style={[typography.body, { fontWeight: '500', flex: 1 }]} numberOfLines={1}>
                  {email.sender_name}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {new Date(email.received_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={[typography.body, { fontSize: 15, marginTop: 2 }]} numberOfLines={1}>
                {email.subject}
              </Text>
              <Text
                style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}
                numberOfLines={2}
              >
                {email.snippet}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />

      {/* Add Rule Modal */}
      <Modal visible={showAddRule} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[typography.h2, { marginBottom: 16 }]}>Add Email Rule</Text>

            <Text style={[typography.caption, styles.inputLabel]}>Rule Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Client Emails"
              placeholderTextColor={colors.textSecondary}
              value={ruleName}
              onChangeText={setRuleName}
              autoFocus
            />

            <Text style={[typography.caption, styles.inputLabel]}>Sender Filter</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. @company.com"
              placeholderTextColor={colors.textSecondary}
              value={ruleSender}
              onChangeText={setRuleSender}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={[typography.caption, styles.inputLabel]}>Label Filter</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. INBOX, IMPORTANT"
              placeholderTextColor={colors.textSecondary}
              value={ruleLabel}
              onChangeText={setRuleLabel}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setShowAddRule(false);
                  setRuleName('');
                  setRuleSender('');
                  setRuleLabel('');
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 17 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreate, (!ruleName.trim() || addingRule) && { opacity: 0.5 }]}
                onPress={handleAddRule}
                disabled={!ruleName.trim() || addingRule}
              >
                {addingRule ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Email Detail Modal */}
      <Modal visible={!!selectedEmail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedEmail && (
              <>
                <Text style={[typography.h2, { marginBottom: 4 }]}>{selectedEmail.subject}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16 }]}>
                  From: {selectedEmail.sender_name} ({selectedEmail.sender_email})
                  {'\n'}
                  {new Date(selectedEmail.received_at).toLocaleString()}
                </Text>

                <ScrollView style={{ maxHeight: 200, marginBottom: 20 }}>
                  <Text style={[typography.body, { lineHeight: 24 }]}>{selectedEmail.snippet}</Text>
                </ScrollView>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => setSelectedEmail(null)}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 17 }}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalCreate, creatingTask && { opacity: 0.5 }]}
                    onPress={() => handleCreateTaskFromEmail(selectedEmail.id)}
                    disabled={creatingTask}
                  >
                    {creatingTask ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>
                        Create Task
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
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
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  connectionLabel: {
    fontWeight: '500',
  },
  connectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  connectionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  disconnectButtonText: {
    color: colors.danger,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  ruleInfo: {
    flex: 1,
    marginRight: 12,
  },
  emailCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  emailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  inputLabel: {
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 17,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundLight,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalCreate: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
});
