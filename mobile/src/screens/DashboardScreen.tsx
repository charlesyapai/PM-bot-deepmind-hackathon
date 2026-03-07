import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  RefreshCw,
  ChevronRight,
  Calendar,
  AlertTriangle,
  FolderOpen,
  Mail,
  Clock,
  Archive,
  Trash2,
  RotateCcw,
  CheckCircle,
  Play,
  Zap,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import {
  getProjects,
  getCalendarEvents,
  triggerBoardUpdate,
  getBoardUpdateHistory,
  applyBoardSuggestions,
  archiveProject,
  hardDeleteProject,
  restoreProject,
  Project,
  CalendarEvent,
  BoardUpdate,
  SuggestedAction,
} from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RootStackParamList = {
  Dashboard: undefined;
  ProjectDetail: { projectId: string; projectTitle: string };
};

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatEventTime(event: CalendarEvent): string {
  if (event.all_day) return 'All day';
  const d = new Date(event.start_time);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// DashboardScreen
// ---------------------------------------------------------------------------

type ProjectTab = 'active' | 'archived';

export const DashboardScreen = ({ navigation }: DashboardScreenProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [lastUpdate, setLastUpdate] = useState<BoardUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [projectTab, setProjectTab] = useState<ProjectTab>('active');

  // Board update detail modal
  const [showUpdateDetail, setShowUpdateDetail] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const [projectsData, eventsData, historyData] = await Promise.all([
        getProjects(projectTab),
        getCalendarEvents(now.toISOString(), in48h.toISOString()).catch(() => [] as CalendarEvent[]),
        getBoardUpdateHistory().catch(() => [] as BoardUpdate[]),
      ]);

      setProjects(projectsData);
      setUpcomingEvents(eventsData.slice(0, 5));
      if (historyData.length > 0) {
        setLastUpdate(historyData[0]);
      }
    } catch {
      // partial failure ok
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData(true);
    });
    return unsubscribe;
  }, [navigation, loadData]);

  const handleArchive = (project: Project) => {
    Alert.alert(
      'Archive Project',
      `Archive "${project.title}"? You can restore it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveProject(project.id);
              setProjects((prev) => prev.filter((p) => p.id !== project.id));
            } catch {
              Alert.alert('Error', 'Failed to archive project.');
            }
          },
        },
      ]
    );
  };

  const handleHardDelete = (project: Project) => {
    Alert.alert(
      'Permanently Delete',
      `This will permanently delete "${project.title}" and all its tasks. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await hardDeleteProject(project.id);
              setProjects((prev) => prev.filter((p) => p.id !== project.id));
            } catch {
              Alert.alert('Error', 'Failed to delete project.');
            }
          },
        },
      ]
    );
  };

  const handleRestore = async (project: Project) => {
    try {
      await restoreProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch {
      Alert.alert('Error', 'Failed to restore project.');
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const result = await triggerBoardUpdate();
      setLastUpdate(result);
      // Auto-select all suggestions
      const count = result.suggestedActions?.length || 0;
      setSelectedSuggestions(new Set(Array.from({ length: count }, (_, i) => i)));
      loadData(true);
    } catch {
      Alert.alert('Update Failed', 'Could not complete board update. Check your connection and Google integration.');
    } finally {
      setUpdating(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleApplySuggestions = async () => {
    const allActions = lastUpdate?.suggestedActions;
    if (!allActions || allActions.length === 0) return;

    const actions = allActions.filter((_, i) => selectedSuggestions.has(i));
    if (actions.length === 0) {
      Alert.alert('No Suggestions Selected', 'Tap suggestions to select which ones to apply.');
      return;
    }

    setApplying(true);
    try {
      const result = await applyBoardSuggestions(actions);
      const succeeded = result.results.filter((r) => r.success);
      const failed = result.results.filter((r) => !r.success);

      // Build detailed message
      let message = '';
      if (succeeded.length > 0) {
        message += succeeded.map((r) => `\u2705 ${r.message}`).join('\n');
      }
      if (failed.length > 0) {
        if (message) message += '\n\n';
        message += failed.map((r) => `\u274C ${r.label}: ${r.message}`).join('\n');
      }

      Alert.alert(
        failed.length > 0 ? `${succeeded.length} Applied, ${failed.length} Failed` : 'All Applied',
        message
      );

      // Only remove succeeded suggestions; keep failed ones for retry
      const selectedIndices = Array.from(selectedSuggestions);
      const succeededLabels = new Set(succeeded.map((r) => r.label));
      const remaining = allActions.filter((action, i) => {
        if (!selectedSuggestions.has(i)) return true; // wasn't selected, keep
        return !succeededLabels.has(action.label); // keep if it failed
      });
      setLastUpdate((prev) => prev ? { ...prev, suggestedActions: remaining } : prev);
      setSelectedSuggestions(new Set(remaining.map((_, i) => i))); // re-select remaining
      if (remaining.length === 0) setShowUpdateDetail(false);
      loadData(true);
    } catch {
      Alert.alert('Error', 'Failed to apply suggestions.');
    } finally {
      setApplying(false);
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
      {/* Board Status Card */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.caption, styles.sectionTitle]}>BOARD STATUS</Text>
          {lastUpdate && (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {timeAgo(lastUpdate.created_at)}
            </Text>
          )}
        </View>

        {updating ? (
          <View style={styles.statusCard}>
            <View style={styles.shimmerRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[typography.body, { color: colors.textSecondary, marginLeft: 12 }]}>
                Updating board...
              </Text>
            </View>
          </View>
        ) : lastUpdate ? (
          <TouchableOpacity
            style={styles.statusCard}
            onPress={() => setShowUpdateDetail(true)}
            activeOpacity={0.7}
          >
            <Text style={[typography.body, styles.statusSummary]} numberOfLines={4}>
              {lastUpdate.summary || 'Board update complete. Tap for details.'}
            </Text>
            {lastUpdate.suggestedActions && lastUpdate.suggestedActions.length > 0 && (
              <View style={styles.suggestionBadge}>
                <Zap color={colors.warning} size={14} />
                <Text style={[typography.caption, { color: colors.warning, marginLeft: 4 }]}>
                  {lastUpdate.suggestedActions.length} suggestion{lastUpdate.suggestedActions.length === 1 ? '' : 's'} ready
                </Text>
              </View>
            )}
            <View style={styles.statusFooter}>
              <Text style={[typography.caption, { color: colors.primary }]}>View full report</Text>
              <ChevronRight color={colors.primary} size={14} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.statusCard}>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              No board updates yet.{'\n'}Tap Update to scan emails, files, and calendar.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.updateButton, updating && { opacity: 0.6 }]}
          onPress={handleUpdate}
          disabled={updating}
        >
          <RefreshCw color="#fff" size={16} />
          <Text style={styles.updateButtonText}>Update Board</Text>
        </TouchableOpacity>

        {lastUpdate?.suggestedActions && lastUpdate.suggestedActions.length > 0 && (
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => setShowUpdateDetail(true)}
          >
            <Zap color="#fff" size={14} />
            <Text style={styles.applyButtonText}>
              Review {lastUpdate.suggestedActions.length} Suggestion{lastUpdate.suggestedActions.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Projects Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.caption, styles.sectionTitle]}>PROJECTS</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {projects.length} {projectTab}
          </Text>
        </View>

        {/* Active / Archived Tabs */}
        <View style={styles.projectTabBar}>
          <TouchableOpacity
            style={[styles.projectTabBtn, projectTab === 'active' && styles.projectTabBtnActive]}
            onPress={() => setProjectTab('active')}
          >
            <Text style={[styles.projectTabText, projectTab === 'active' && styles.projectTabTextActive]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.projectTabBtn, projectTab === 'archived' && styles.projectTabBtnActive]}
            onPress={() => setProjectTab('archived')}
          >
            <Text style={[styles.projectTabText, projectTab === 'archived' && styles.projectTabTextActive]}>
              Archived
            </Text>
          </TouchableOpacity>
        </View>

        {projects.length === 0 ? (
          <View style={styles.card}>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 }]}>
              {projectTab === 'archived'
                ? 'No archived projects.'
                : 'No active projects. Use voice to create one.'}
            </Text>
          </View>
        ) : (
          projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.projectCard}
              onPress={() =>
                navigation.navigate('ProjectDetail', {
                  projectId: project.id,
                  projectTitle: project.title,
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.projectCardHeader}>
                <FolderOpen color={projectTab === 'archived' ? colors.textSecondary : colors.primary} size={18} />
                <Text style={[typography.body, styles.projectTitle]} numberOfLines={1}>
                  {project.title}
                </Text>
                <ChevronRight color={colors.textSecondary} size={16} />
              </View>
              <View style={styles.projectCardMeta}>
                <Text style={[typography.caption, { color: colors.textSecondary, textTransform: 'capitalize' }]}>
                  {project.template}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Updated {timeAgo(project.updated_at || project.created_at)}
                </Text>
              </View>
              {/* Action buttons */}
              <View style={styles.projectActions}>
                {projectTab === 'archived' ? (
                  <>
                    <TouchableOpacity
                      style={styles.projectActionBtn}
                      onPress={() => handleRestore(project)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <RotateCcw color={colors.success} size={14} />
                      <Text style={[styles.projectActionText, { color: colors.success }]}>Restore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.projectActionBtn}
                      onPress={() => handleHardDelete(project)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 color={colors.danger} size={14} />
                      <Text style={[styles.projectActionText, { color: colors.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.projectActionBtn}
                    onPress={() => handleArchive(project)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Archive color={colors.warning} size={14} />
                    <Text style={[styles.projectActionText, { color: colors.warning }]}>Archive</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Upcoming Strip */}
      <View style={styles.section}>
        <Text style={[typography.caption, styles.sectionTitle]}>UPCOMING (48H)</Text>

        {upcomingEvents.length === 0 ? (
          <View style={styles.card}>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 }]}>
              No upcoming events.
            </Text>
          </View>
        ) : (
          upcomingEvents.map((event) => (
            <View key={event.id} style={styles.upcomingRow}>
              <View style={styles.upcomingTime}>
                <Clock color={colors.textSecondary} size={12} />
                <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
                  {formatEventTime(event)}
                </Text>
              </View>
              <Text style={[typography.body, { flex: 1, fontSize: 15 }]} numberOfLines={1}>
                {event.title}
              </Text>
              {event.google_event_id && (
                <View style={styles.gcalBadge}>
                  <Text style={styles.gcalBadgeText}>GCal</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 32 }} />

      {/* Board Update Detail Modal */}
      <Modal visible={showUpdateDetail} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowUpdateDetail(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUpdateDetail(false)}>
              <Text style={[typography.body, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[typography.body, { fontWeight: '600' }]}>Board Update Report</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={styles.modalBody}>
            {lastUpdate && (
              <>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16 }]}>
                  {new Date(lastUpdate.created_at).toLocaleString()} · {lastUpdate.trigger}
                </Text>
                <Text style={[typography.body, { lineHeight: 24, marginBottom: 24 }]}>
                  {lastUpdate.summary}
                </Text>

                {/* Suggested Actions */}
                {lastUpdate.suggestedActions && lastUpdate.suggestedActions.length > 0 && (
                  <View style={styles.reportSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Zap color={colors.warning} size={16} />
                      <Text style={[typography.body, { fontWeight: '600', marginLeft: 6 }]}>
                        Suggested Actions ({lastUpdate.suggestedActions.length})
                      </Text>
                    </View>
                    {lastUpdate.suggestedActions.map((action, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.suggestionCard, selectedSuggestions.has(i) && styles.suggestionCardSelected]}
                        onPress={() => toggleSuggestion(i)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.suggestionCheckbox, selectedSuggestions.has(i) && styles.suggestionCheckboxSelected]}>
                          {selectedSuggestions.has(i) && <CheckCircle color="#fff" size={16} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.body, { fontSize: 14 }]}>{action.label}</Text>
                          <Text style={[typography.caption, { color: colors.textSecondary }]}>{action.type.replace('_', ' ')}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.applyButton, { marginTop: 12 }, (applying || selectedSuggestions.size === 0) && { opacity: 0.6 }]}
                      onPress={handleApplySuggestions}
                      disabled={applying || selectedSuggestions.size === 0}
                    >
                      {applying ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <CheckCircle color="#fff" size={16} />
                      )}
                      <Text style={styles.applyButtonText}>
                        Apply {selectedSuggestions.size} of {lastUpdate.suggestedActions.length} Suggestion{selectedSuggestions.size === 1 ? '' : 's'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {lastUpdate.sections && lastUpdate.sections.length > 0 && (
                  lastUpdate.sections.map((section, idx) => (
                    <View key={idx} style={styles.reportSection}>
                      <Text style={[typography.body, { fontWeight: '600', marginBottom: 8 }]}>
                        {section.title}
                      </Text>
                      {section.items.map((item, i) => (
                        <View key={i} style={styles.reportItem}>
                          <Text style={[typography.body, { fontSize: 15 }]}>{item.label}</Text>
                          <Text style={[typography.caption, { color: colors.textSecondary }]}>
                            {item.detail}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  // Board status
  statusCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  shimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  statusSummary: {
    color: colors.textPrimary,
    lineHeight: 22,
    fontSize: 15,
  },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    gap: 8,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34A853',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
    gap: 6,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  suggestionCardSelected: {
    borderColor: '#34A853',
    backgroundColor: '#F0FFF4',
  },
  suggestionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionCheckboxSelected: {
    backgroundColor: '#34A853',
    borderColor: '#34A853',
  },
  // Project cards
  projectCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  projectCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  projectTitle: {
    flex: 1,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  projectCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginLeft: 28,
  },
  projectActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 16,
  },
  projectActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  projectActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  projectTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  projectTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  projectTabBtnActive: {
    backgroundColor: colors.primary,
  },
  projectTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  projectTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Upcoming
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 8,
  },
  upcomingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  gcalBadge: {
    backgroundColor: 'rgba(52,199,89,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gcalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.3,
  },
  // Modal
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
  modalBody: {
    padding: 16,
  },
  reportSection: {
    marginBottom: 20,
  },
  reportItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
