import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getTasks, getDailySummary, updateTask, aiEditTask, Task } from '../services/api';

const PRIORITY_COLORS: Record<string, string> = {
  high: colors.danger,
  medium: colors.warning,
  low: colors.success,
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  todo: colors.textSecondary,
  in_progress: colors.primary,
  done: colors.success,
  blocked: colors.danger,
};

const TAG_COLORS: Record<string, string> = {
  big: '#FF6B6B',
  medium: '#FFA94D',
  small: '#51CF66',
  meeting: '#845EF7',
  'email-reply': '#339AF0',
  research: '#20C997',
  writing: '#F06595',
  review: '#FF922B',
  admin: '#868E96',
  analysis: '#5C7CFA',
  coding: '#099268',
  urgent: '#FF3B30',
  'follow-up': '#FCC419',
  external: '#AE3EC9',
};

const DailySummaryCard = ({ summary, loading: summaryLoading }: { summary: string | null; loading: boolean }) => {
  if (summaryLoading) {
    return (
      <View style={styles.summaryCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[typography.caption, styles.summaryLoadingText]}>Analyzing your tasks...</Text>
        </View>
      </View>
    );
  }
  if (!summary) return null;
  return (
    <View style={styles.summaryCard}>
      <Text style={[typography.caption, styles.summaryLabel]}>Today's Focus</Text>
      <Text style={[typography.body, styles.summaryText]}>{summary}</Text>
    </View>
  );
};

interface TaskRowProps {
  task: Task;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, fields: Partial<Task>) => void;
  onLocalUpdate: (id: string, fields: Partial<Task>) => void;
}

const TaskRow = ({ task, isExpanded, onToggle, onUpdate, onLocalUpdate }: TaskRowProps) => {
  const [actionInput, setActionInput] = useState('');
  const [updating, setUpdating] = useState(false);
  const priorityColor = PRIORITY_COLORS[task.priority] ?? colors.textSecondary;
  const statusColor = STATUS_BADGE_COLORS[task.status] ?? colors.textSecondary;
  const statusLabel = STATUS_LABELS[task.status] ?? task.status;
  const tags = task.tags || [];

  const handleQuickAction = async (action: 'done' | 'blocked' | 'in_progress') => {
    setUpdating(true);
    try {
      await onUpdate(task.id, { status: action });
    } finally {
      setUpdating(false);
    }
  };

  const handleNote = async () => {
    const text = actionInput.trim();
    if (!text) return;
    setUpdating(true);
    try {
      const existing = task.description || '';
      const updated = existing ? `${existing}\n${text}` : text;
      await onUpdate(task.id, { description: updated });
      setActionInput('');
    } finally {
      setUpdating(false);
    }
  };

  const handleAiEdit = async () => {
    const text = actionInput.trim();
    if (!text) return;
    setUpdating(true);
    try {
      const result = await aiEditTask(task.id, text);
      if (result.task) {
        onLocalUpdate(task.id, result.task);
      }
      Alert.alert('AI Edit', result.message);
      setActionInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI edit failed';
      Alert.alert('Error', msg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.taskCard, task.status === 'done' && styles.taskCardDone]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
      <View style={styles.taskBody}>
        {/* Title + status */}
        <View style={styles.taskHeader}>
          <Text
            style={[typography.body, styles.taskTitle, task.status === 'done' && styles.taskTitleDone]}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {task.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        {/* Tags row */}
        {tags.length > 0 && (
          <View style={styles.tagsRow}>
            {tags.map((tag, i) => (
              <View
                key={i}
                style={[styles.tagPill, { backgroundColor: (TAG_COLORS[tag] || '#868E96') + '22' }]}
              >
                <Text style={[styles.tagText, { color: TAG_COLORS[tag] || '#868E96' }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Meta row: priority + due date */}
        <View style={styles.taskMeta}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={[typography.caption, styles.metaText]}>
            {task.priority}
          </Text>
          {task.due_date && (
            <Text style={[
              typography.caption,
              styles.metaText,
              new Date(task.due_date) < new Date() && task.status !== 'done' && styles.overdue,
            ]}>
              {' · Due '}
              {new Date(task.due_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          )}
        </View>

        {/* Expanded section */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            {task.description ? (
              <Text style={styles.descriptionText}>{task.description}</Text>
            ) : (
              <Text style={styles.noDescription}>No description yet</Text>
            )}

            {/* Quick action buttons */}
            <View style={styles.quickActions}>
              {task.status !== 'done' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionDone]}
                  onPress={() => handleQuickAction('done')}
                  disabled={updating}
                >
                  <Text style={styles.actionBtnText}>Done</Text>
                </TouchableOpacity>
              )}
              {task.status !== 'blocked' && task.status !== 'done' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBlocked]}
                  onPress={() => handleQuickAction('blocked')}
                  disabled={updating}
                >
                  <Text style={styles.actionBtnText}>Blocked</Text>
                </TouchableOpacity>
              )}
              {task.status !== 'in_progress' && task.status !== 'done' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionProgress]}
                  onPress={() => handleQuickAction('in_progress')}
                  disabled={updating}
                >
                  <Text style={styles.actionBtnText}>Start</Text>
                </TouchableOpacity>
              )}
              {updating && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {/* Text input for actions */}
            <View style={styles.actionInputRow}>
              <TextInput
                style={styles.actionInput}
                placeholder="Add a note or AI instruction..."
                placeholderTextColor={colors.textSecondary}
                value={actionInput}
                onChangeText={setActionInput}
                returnKeyType="done"
                editable={!updating}
              />
              {actionInput.length > 0 && !updating && (
                <View style={styles.inputButtons}>
                  <TouchableOpacity
                    style={[styles.sendBtn, styles.noteBtn]}
                    onPress={handleNote}
                  >
                    <Text style={styles.sendBtnText}>Note</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendBtn, styles.aiBtn]}
                    onPress={handleAiEdit}
                  >
                    <Text style={styles.sendBtnText}>AI</Text>
                  </TouchableOpacity>
                </View>
              )}
              {updating && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const TasksScreen = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getTasks();
      data.sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
      setTasks(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load tasks.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const { summary } = await getDailySummary();
      setDailySummary(summary);
    } catch {
      setDailySummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadSummary();
  }, [loadTasks, loadSummary]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTasks(true);
    loadSummary();
  };

  const handleUpdateTask = async (id: string, fields: Partial<Task>) => {
    try {
      const updated = await updateTask(id, fields);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      Alert.alert('Error', msg);
    }
  };

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
        <TouchableOpacity style={styles.retryButton} onPress={() => loadTasks()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Group tasks by project for section headers
  const projectMap = new Map<string, Task[]>();
  for (const task of tasks) {
    const pTitle = task.projects?.title || 'Uncategorized';
    if (!projectMap.has(pTitle)) projectMap.set(pTitle, []);
    projectMap.get(pTitle)!.push(task);
  }

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  type ListItem = { type: 'header'; title: string; count: number; collapsed: boolean } | { type: 'task'; task: Task };
  const listData: ListItem[] = [];
  for (const [title, groupTasks] of projectMap) {
    const pendingCount = groupTasks.filter((t) => t.status !== 'done').length;
    const collapsed = collapsedSections.has(title);
    listData.push({ type: 'header', title, count: pendingCount, collapsed });
    if (!collapsed) {
      for (const task of groupTasks) {
        listData.push({ type: 'task', task });
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          item.type === 'header' ? `header-${index}` : item.task.id
        }
        contentContainerStyle={tasks.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          tasks.length > 0 ? (
            <DailySummaryCard summary={dailySummary} loading={summaryLoading} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[typography.body, styles.emptyText]}>
              No tasks yet. Use the voice button or run a board update to get started.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(item.title)}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionChevron}>{item.collapsed ? '▶' : '▼'}</Text>
                <Text style={styles.sectionTitle}>{item.title}</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionCount}>{item.count}</Text>
                </View>
              </TouchableOpacity>
            );
          }
          return (
            <TaskRow
              task={item.task}
              isExpanded={expandedTaskId === item.task.id}
              onToggle={() =>
                setExpandedTaskId(expandedTaskId === item.task.id ? null : item.task.id)
              }
              onUpdate={handleUpdateTask}
              onLocalUpdate={(id, fields) =>
                setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)))
              }
            />
          );
        }}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
};

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
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
    padding: 16,
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
  summaryCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryText: {
    color: colors.textPrimary,
    lineHeight: 22,
    fontSize: 14,
  },
  summaryLoadingText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionChevron: {
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: 6,
    width: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: colors.primary + '20',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardDone: {
    opacity: 0.5,
  },
  priorityBar: {
    width: 4,
  },
  taskBody: {
    flex: 1,
    padding: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  taskTitle: {
    flex: 1,
    fontWeight: '500',
    color: colors.textPrimary,
    marginRight: 8,
    fontSize: 15,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.cardBackground,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 4,
  },
  tagPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  metaText: {
    color: colors.textSecondary,
    textTransform: 'capitalize',
    fontSize: 12,
  },
  overdue: {
    color: colors.danger,
    fontWeight: '600',
  },
  expandedSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundLight,
    paddingTop: 10,
  },
  descriptionText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },
  noDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  actionDone: {
    backgroundColor: colors.success,
  },
  actionBlocked: {
    backgroundColor: colors.danger,
  },
  actionProgress: {
    backgroundColor: colors.primary,
  },
  actionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionInput: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
  },
  inputButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sendBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noteBtn: {
    backgroundColor: colors.textSecondary,
  },
  aiBtn: {
    backgroundColor: colors.primary,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
