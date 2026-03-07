import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { RefreshCw } from 'lucide-react-native';
import {
  getCalendarEvents,
  createCalendarEvent,
  getProjects,
  syncCalendar,
  CalendarEvent,
  Project,
} from '../services/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Section = { title: string; dateStr: string; data: CalendarEvent[] };

function groupByDay(events: CalendarEvent[]): Section[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = dateKey(ev.start_time);
    const arr = map.get(key) ?? [];
    arr.push(ev);
    map.set(key, arr);
  }

  const sections: Section[] = [];
  const sortedKeys = Array.from(map.keys()).sort();
  for (const key of sortedKeys) {
    sections.push({
      title: formatDateHeading(key),
      dateStr: key,
      data: map.get(key)!.sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ),
    });
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Status indicator colors
// ---------------------------------------------------------------------------

const EVENT_STATUS_COLORS: Record<string, string> = {
  scheduled: colors.primary,
  completed: colors.success,
  cancelled: colors.textSecondary,
};

// ---------------------------------------------------------------------------
// EventCard
// ---------------------------------------------------------------------------

const EventCard = ({
  event,
  projectName,
}: {
  event: CalendarEvent;
  projectName: string | null;
}) => {
  const statusColor = EVENT_STATUS_COLORS[event.status] ?? colors.primary;
  const timeLabel = event.all_day
    ? 'All day'
    : event.end_time
    ? `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`
    : formatTime(event.start_time);

  const isGoogleEvent = !!event.google_event_id;
  const sourceLabel = isGoogleEvent ? 'GCal' : 'App';
  const isExternal = isGoogleEvent && !event.project_id;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[typography.body, styles.cardTitle, { flex: 1 }]} numberOfLines={1}>
              {event.title}
            </Text>
            <View style={[styles.sourceBadge, isGoogleEvent ? styles.sourceBadgeGcal : styles.sourceBadgeApp]}>
              <Text style={[styles.sourceBadgeText, isGoogleEvent ? styles.sourceBadgeTextGcal : styles.sourceBadgeTextApp]}>
                {sourceLabel}
              </Text>
            </View>
          </View>
          <Text style={[typography.caption, styles.timeText]}>{timeLabel}</Text>
          {projectName ? (
            <Text style={[typography.caption, styles.projectText]} numberOfLines={1}>
              {projectName}
            </Text>
          ) : isExternal ? (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              External
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// CalendarScreen
// ---------------------------------------------------------------------------

export const CalendarScreen = ({ navigation }: { navigation: any }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Build project lookup
  const projectMap = new Map<string, string>();
  for (const p of projects) {
    projectMap.set(p.id, p.title);
  }

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [eventsData, projectsData] = await Promise.all([
        getCalendarEvents(),
        getProjects(),
      ]);
      setEvents(eventsData);
      setProjects(projectsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load events.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncCalendar();
      Alert.alert('Calendar Synced', `Synced ${result.synced} event${result.synced !== 1 ? 's' : ''} with Google Calendar.`);
      loadData(true);
    } catch {
      Alert.alert('Sync Failed', 'Could not sync with Google Calendar. Make sure Google is connected in Settings.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSync} disabled={syncing} style={styles.headerButton}>
            {syncing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <RefreshCw color={colors.primary} size={20} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const today = todayKey();
              setNewDate(today);
              setNewTime('09:00');
              setNewEndTime('10:00');
              setAllDay(false);
              setNewTitle('');
              setSelectedProjectId(null);
              setModalVisible(true);
            }}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, syncing]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter an event title.');
      return;
    }
    if (!newDate.trim()) {
      Alert.alert('Error', 'Please enter a date (YYYY-MM-DD).');
      return;
    }

    setCreating(true);
    try {
      const startTime = allDay
        ? `${newDate}T00:00:00`
        : `${newDate}T${newTime || '09:00'}:00`;
      const endTime =
        !allDay && newEndTime
          ? `${newDate}T${newEndTime}:00`
          : null;

      const event = await createCalendarEvent({
        title: newTitle.trim(),
        start_time: startTime,
        end_time: endTime,
        all_day: allDay,
        project_id: selectedProjectId,
      });
      setEvents((prev) => [...prev, event]);
      setModalVisible(false);
      setNewTitle('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create event.';
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  };

  const sections = groupByDay(events);
  const today = todayKey();

  // Ensure Today section exists at the top even if empty
  const todayExists = sections.some((s) => s.dateStr === today);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[typography.body, styles.errorText]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[typography.body, styles.emptyText]}>
            No events scheduled.{'\n'}Use voice or tap + to add one.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          renderSectionHeader={({ section }) => (
            <View
              style={[
                styles.sectionHeader,
                section.dateStr === today && styles.sectionHeaderToday,
              ]}
            >
              <Text
                style={[
                  typography.body,
                  styles.sectionTitle,
                  section.dateStr === today && styles.sectionTitleToday,
                ]}
              >
                {section.dateStr === today ? 'Today' : section.title}
              </Text>
              {section.dateStr === today && (
                <Text style={[typography.caption, styles.sectionSubtitle]}>
                  {section.title}
                </Text>
              )}
            </View>
          )}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              projectName={item.project_id ? projectMap.get(item.project_id) ?? null : null}
            />
          )}
        />
      )}

      {/* Create Event Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} disabled={creating}>
              <Text style={[typography.body, styles.modalCancel]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[typography.body, styles.modalTitle]}>New Event</Text>
            <TouchableOpacity onPress={handleCreate} disabled={creating}>
              {creating ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[typography.body, styles.modalDone]}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={[typography.caption, styles.inputLabel]}>Event Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Team standup"
              placeholderTextColor={colors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              editable={!creating}
            />

            <Text style={[typography.caption, styles.inputLabel]}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="2026-03-07"
              placeholderTextColor={colors.textSecondary}
              value={newDate}
              onChangeText={setNewDate}
              editable={!creating}
              keyboardType="numbers-and-punctuation"
            />

            {/* All-day toggle */}
            <TouchableOpacity
              style={styles.allDayRow}
              onPress={() => setAllDay((v) => !v)}
              disabled={creating}
            >
              <View style={[styles.checkbox, allDay && styles.checkboxChecked]}>
                {allDay && <Text style={styles.checkmark}>{'✓'}</Text>}
              </View>
              <Text style={[typography.body, styles.allDayLabel]}>All day</Text>
            </TouchableOpacity>

            {!allDay && (
              <>
                <Text style={[typography.caption, styles.inputLabel]}>Start Time (HH:MM)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="09:00"
                  placeholderTextColor={colors.textSecondary}
                  value={newTime}
                  onChangeText={setNewTime}
                  editable={!creating}
                  keyboardType="numbers-and-punctuation"
                />

                <Text style={[typography.caption, styles.inputLabel]}>End Time (HH:MM)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="10:00"
                  placeholderTextColor={colors.textSecondary}
                  value={newEndTime}
                  onChangeText={setNewEndTime}
                  editable={!creating}
                  keyboardType="numbers-and-punctuation"
                />
              </>
            )}

            {/* Optional project link */}
            {projects.length > 0 && (
              <>
                <Text style={[typography.caption, styles.inputLabel]}>Link to Project (optional)</Text>
                <View style={styles.projectPicker}>
                  <TouchableOpacity
                    style={[
                      styles.projectChip,
                      selectedProjectId === null && styles.projectChipSelected,
                    ]}
                    onPress={() => setSelectedProjectId(null)}
                    disabled={creating}
                  >
                    <Text
                      style={[
                        typography.caption,
                        styles.projectChipText,
                        selectedProjectId === null && styles.projectChipTextSelected,
                      ]}
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {projects.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.projectChip,
                        selectedProjectId === p.id && styles.projectChipSelected,
                      ]}
                      onPress={() => setSelectedProjectId(p.id)}
                      disabled={creating}
                    >
                      <Text
                        style={[
                          typography.caption,
                          styles.projectChipText,
                          selectedProjectId === p.id && styles.projectChipTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {p.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
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
    padding: 16,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: colors.cardBackground,
    fontSize: 17,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '300',
    lineHeight: 32,
  },
  // Section headers
  sectionHeader: {
    marginBottom: 8,
    marginTop: 16,
  },
  sectionHeaderToday: {
    marginTop: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionTitleToday: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 20,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Event card
  card: {
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardTitle: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  sourceBadgeGcal: {
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  sourceBadgeApp: {
    backgroundColor: 'rgba(0,122,255,0.10)',
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sourceBadgeTextGcal: {
    color: colors.success,
  },
  sourceBadgeTextApp: {
    color: colors.primary,
  },
  timeText: {
    color: colors.textSecondary,
  },
  projectText: {
    color: colors.primary,
    marginTop: 4,
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
  modalTitle: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalCancel: {
    color: colors.textSecondary,
  },
  modalDone: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 16,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 17,
    color: colors.textPrimary,
    backgroundColor: colors.cardBackground,
  },
  allDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  allDayLabel: {
    color: colors.textPrimary,
  },
  projectPicker: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  projectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.cardBackground,
    maxWidth: 160,
  },
  projectChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  projectChipText: {
    color: colors.textSecondary,
  },
  projectChipTextSelected: {
    color: colors.cardBackground,
    fontWeight: '600',
  },
});
