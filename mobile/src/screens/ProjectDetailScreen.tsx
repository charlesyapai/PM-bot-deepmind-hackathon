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
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import {
  Paperclip,
  FileText,
  Image,
  File,
  Upload,
  ExternalLink,
  Mail,
  CheckSquare,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import {
  getTasks,
  updateTask,
  createTask,
  Task,
  TaskPriority,
  Attachment,
  getAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentDownloadUrl,
  getDriveFiles,
  uploadToDrive,
  DriveFile,
  getProjectEmails,
  createTaskFromEmail,
  ImportedEmail,
} from '../services/api';

type RootStackParamList = {
  ProjectDetail: { projectId: string; projectTitle: string };
};

type ProjectDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProjectDetail'>;
  route: RouteProp<RootStackParamList, 'ProjectDetail'>;
};

type TabKey = 'tasks' | 'files' | 'emails';

const PRIORITY_COLORS: Record<string, string> = {
  high: colors.danger,
  medium: colors.warning,
  low: colors.success,
};

// ---------------------------------------------------------------------------
// File type icon helper
// ---------------------------------------------------------------------------

const getFileIcon = (fileType: string | null, size = 12) => {
  if (!fileType) return <File color={colors.textSecondary} size={size} />;
  if (fileType.startsWith('image/')) return <Image color={colors.primary} size={size} />;
  if (fileType.includes('pdf') || fileType.includes('document'))
    return <FileText color={colors.danger} size={size} />;
  return <File color={colors.textSecondary} size={size} />;
};

// ---------------------------------------------------------------------------
// Tab Strip
// ---------------------------------------------------------------------------

const TABS: { key: TabKey; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'files', label: 'Files' },
  { key: 'emails', label: 'Emails' },
];

const TabStrip = ({
  activeTab,
  onSelect,
}: {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
}) => (
  <View style={styles.tabStrip}>
    {TABS.map((tab) => (
      <TouchableOpacity
        key={tab.key}
        style={[styles.tab, activeTab === tab.key && styles.tabActive]}
        onPress={() => onSelect(tab.key)}
      >
        <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ---------------------------------------------------------------------------
// Attachment Chip
// ---------------------------------------------------------------------------

const AttachmentChip = ({
  attachment,
  onPress,
  onLongPress,
}: {
  attachment: Attachment;
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const truncatedName =
    attachment.file_name.length > 18
      ? attachment.file_name.slice(0, 15) + '...'
      : attachment.file_name;

  return (
    <TouchableOpacity
      style={styles.attachmentChip}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {getFileIcon(attachment.file_type)}
      <Text style={styles.attachmentChipText}>{truncatedName}</Text>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Checklist Item
// ---------------------------------------------------------------------------

const ChecklistItem = ({
  task,
  onToggle,
  attachments,
  onAttachmentPress,
  onAttachmentLongPress,
}: {
  task: Task;
  onToggle: (id: string, currentStatus: Task['status']) => void;
  attachments?: Attachment[];
  onAttachmentPress?: (attachment: Attachment) => void;
  onAttachmentLongPress?: (attachment: Attachment) => void;
}) => {
  const isDone = task.status === 'done';
  const priorityColor = PRIORITY_COLORS[task.priority] ?? colors.textSecondary;

  return (
    <TouchableOpacity
      style={styles.checklistItem}
      onPress={() => onToggle(task.id, task.status)}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
        {isDone && <Text style={styles.checkmark}>{'✓'}</Text>}
      </View>
      <View style={styles.taskContent}>
        <Text
          style={[typography.body, styles.taskTitle, isDone && styles.taskTitleDone]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <View style={styles.taskMeta}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={[typography.caption, styles.priorityText]}>{task.priority}</Text>
          {task.due_date && (
            <Text style={[typography.caption, styles.dueDateText]}>
              {' · '}
              {new Date(task.due_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          )}
        </View>
        {attachments && attachments.length > 0 && (
          <View style={styles.attachmentRow}>
            {attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                attachment={att}
                onPress={() => onAttachmentPress?.(att)}
                onLongPress={() => onAttachmentLongPress?.(att)}
              />
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Drive File Row
// ---------------------------------------------------------------------------

const DriveFileRow = ({ file, onPress }: { file: DriveFile; onPress: () => void }) => {
  const modifiedLabel = new Date(file.modifiedTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity style={styles.driveFileRow} onPress={onPress} activeOpacity={0.7}>
      {getFileIcon(file.mimeType, 20)}
      <View style={styles.driveFileInfo}>
        <Text style={[typography.body, { fontWeight: '500' }]} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          Modified {modifiedLabel}
        </Text>
      </View>
      <ExternalLink color={colors.textSecondary} size={16} />
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Email Row
// ---------------------------------------------------------------------------

const EmailRow = ({
  email,
  onCreateTask,
  creatingTaskId,
}: {
  email: ImportedEmail;
  onCreateTask: (id: string) => void;
  creatingTaskId: string | null;
}) => {
  const dateLabel = new Date(email.received_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.emailRow}>
      <View style={styles.emailHeader}>
        <Text style={[typography.body, { fontWeight: '500', flex: 1 }]} numberOfLines={1}>
          {email.sender_name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{dateLabel}</Text>
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
      <View style={styles.emailActions}>
        <TouchableOpacity
          style={styles.emailActionBtn}
          onPress={() => onCreateTask(email.id)}
          disabled={creatingTaskId === email.id}
        >
          {creatingTaskId === email.id ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <CheckSquare color={colors.primary} size={14} />
              <Text style={styles.emailActionText}>Create Task</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

export const ProjectDetailScreen = ({ navigation, route }: ProjectDetailScreenProps) => {
  const { projectId, projectTitle } = route.params;
  const [activeTab, setActiveTab] = useState<TabKey>('tasks');

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add task modal state
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [addingTask, setAddingTask] = useState(false);

  // Attachment state
  const [attachmentMap, setAttachmentMap] = useState<Record<string, Attachment[]>>({});
  const [projectAttachments, setProjectAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Drive files state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Emails state
  const [emails, setEmails] = useState<ImportedEmail[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: projectTitle,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {activeTab === 'tasks' && (
            <TouchableOpacity onPress={() => handlePickFile()} style={{ paddingHorizontal: 4 }}>
              <Paperclip color={colors.primary} size={22} />
            </TouchableOpacity>
          )}
          {activeTab === 'files' && (
            <TouchableOpacity onPress={handleUploadToDrive} style={{ paddingHorizontal: 4 }}>
              <Upload color={colors.primary} size={22} />
            </TouchableOpacity>
          )}
          {activeTab === 'tasks' && (
            <TouchableOpacity onPress={() => setShowAddTask(true)} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '400' }}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, projectTitle, activeTab]);

  // --- Data loaders ---

  const loadTasks = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getTasks(projectId);
        setTasks(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load tasks.';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId]
  );

  const loadAttachments = useCallback(async () => {
    try {
      const data = await getAttachments(undefined, projectId);
      const grouped: Record<string, Attachment[]> = {};
      const projLevel: Attachment[] = [];
      for (const att of data) {
        if (att.task_id) {
          if (!grouped[att.task_id]) grouped[att.task_id] = [];
          grouped[att.task_id].push(att);
        } else {
          projLevel.push(att);
        }
      }
      setAttachmentMap(grouped);
      setProjectAttachments(projLevel);
    } catch {
      // supplementary
    }
  }, [projectId]);

  const loadDriveFiles = useCallback(async () => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const data = await getDriveFiles(projectId);
      setDriveFiles(data);
    } catch {
      setDriveError('Could not load Drive files. Make sure Google is connected.');
    } finally {
      setDriveLoading(false);
    }
  }, [projectId]);

  const loadEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const data = await getProjectEmails(projectId);
      setEmails(data);
    } catch {
      // non-critical
    } finally {
      setEmailsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTasks();
    loadAttachments();
  }, [loadTasks, loadAttachments]);

  // Lazy-load files and emails when tab is first selected
  useEffect(() => {
    if (activeTab === 'files' && driveFiles.length === 0 && !driveLoading) {
      loadDriveFiles();
    }
    if (activeTab === 'emails' && emails.length === 0 && !emailsLoading) {
      loadEmails();
    }
  }, [activeTab]);

  // --- Handlers ---

  const handlePickFile = async (taskId?: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setUploading(true);
      const uploaded = await uploadAttachment(
        { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' },
        taskId,
        projectId
      );

      if (taskId) {
        setAttachmentMap((prev) => ({
          ...prev,
          [taskId]: [...(prev[taskId] || []), uploaded],
        }));
      } else {
        setProjectAttachments((prev) => [...prev, uploaded]);
      }
    } catch {
      Alert.alert('Error', 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadToDrive = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setUploading(true);
      await uploadToDrive(projectId, {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      });
      loadDriveFiles();
    } catch {
      Alert.alert('Error', 'Failed to upload to Google Drive. Make sure Google is connected.');
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentPress = async (attachment: Attachment) => {
    try {
      const { url } = await getAttachmentDownloadUrl(attachment.id);
      Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Failed to get download URL.');
    }
  };

  const handleAttachmentLongPress = (attachment: Attachment) => {
    Alert.alert('Delete Attachment', `Remove "${attachment.file_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAttachment(attachment.id);
            if (attachment.task_id) {
              setAttachmentMap((prev) => ({
                ...prev,
                [attachment.task_id!]: (prev[attachment.task_id!] || []).filter(
                  (a) => a.id !== attachment.id
                ),
              }));
            } else {
              setProjectAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
            }
          } catch {
            Alert.alert('Error', 'Failed to delete attachment.');
          }
        },
      },
    ]);
  };

  const handleToggle = async (id: string, currentStatus: Task['status']) => {
    const newStatus: Task['status'] = currentStatus === 'done' ? 'todo' : 'done';
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    try {
      await updateTask(id, { status: newStatus });
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: currentStatus } : t)));
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const created = await createTask({
        title: newTaskTitle.trim(),
        project_id: projectId,
        priority: newTaskPriority,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskPriority('medium');
      setShowAddTask(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create task.';
      Alert.alert('Error', message);
    } finally {
      setAddingTask(false);
    }
  };

  const handleCreateTaskFromEmail = async (emailId: string) => {
    setCreatingTaskId(emailId);
    try {
      await createTaskFromEmail(emailId);
      Alert.alert('Success', 'Task created from email.');
      loadTasks(true);
    } catch {
      Alert.alert('Error', 'Failed to create task from email.');
    } finally {
      setCreatingTaskId(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'tasks') {
      loadTasks(true);
      loadAttachments();
    } else if (activeTab === 'files') {
      loadDriveFiles();
      setRefreshing(false);
    } else {
      loadEmails();
      setRefreshing(false);
    }
  };

  const handleDriveFilePress = (file: DriveFile) => {
    if (file.webViewLink) {
      Linking.openURL(file.webViewLink);
    } else {
      Alert.alert('Info', 'No web link available for this file.');
    }
  };

  // --- Derived data ---

  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const completedTasks = tasks.filter((t) => t.status === 'done');
  const allTasks: Task[] = [...pendingTasks, ...completedTasks];

  // --- Render ---

  const renderTasksTab = () => {
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

    return (
      <FlatList
        data={allTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={allTasks.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {(projectAttachments.length > 0 || uploading) && (
              <View style={styles.projectAttachments}>
                <Text style={[typography.caption, styles.sectionHeaderText]}>PROJECT FILES</Text>
                <View style={styles.attachmentRow}>
                  {projectAttachments.map((att) => (
                    <AttachmentChip
                      key={att.id}
                      attachment={att}
                      onPress={() => handleAttachmentPress(att)}
                      onLongPress={() => handleAttachmentLongPress(att)}
                    />
                  ))}
                  {uploading && (
                    <View style={styles.attachmentChip}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                </View>
              </View>
            )}
            {tasks.length > 0 && (
              <View style={styles.progressContainer}>
                <Text style={[typography.caption, styles.progressText]}>
                  {completedTasks.length} / {tasks.length} completed
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(completedTasks.length / tasks.length) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[typography.body, styles.emptyText]}>
              No tasks yet. Use the voice button or tap + to add tasks.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const showCompletedHeader =
            completedTasks.length > 0 && index === pendingTasks.length;
          return (
            <>
              {showCompletedHeader && (
                <View style={styles.sectionHeader}>
                  <Text style={[typography.caption, styles.sectionHeaderText]}>Completed</Text>
                </View>
              )}
              <ChecklistItem
                task={item}
                onToggle={handleToggle}
                attachments={attachmentMap[item.id]}
                onAttachmentPress={handleAttachmentPress}
                onAttachmentLongPress={handleAttachmentLongPress}
              />
            </>
          );
        }}
      />
    );
  };

  const renderFilesTab = () => {
    if (driveLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (driveError) {
      return (
        <View style={styles.centered}>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }]}>
            {driveError}
          </Text>
          <TouchableOpacity style={[styles.retryButton, { marginTop: 16 }]} onPress={loadDriveFiles}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (driveFiles.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={[typography.body, styles.emptyText]}>
            No Drive files yet.{'\n'}Tap the upload button to add files.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={driveFiles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={loadDriveFiles}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <DriveFileRow file={item} onPress={() => handleDriveFilePress(item)} />
        )}
      />
    );
  };

  const renderEmailsTab = () => {
    if (emailsLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (emails.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={[typography.body, styles.emptyText]}>
            No emails matched to this project yet.{'\n'}Connect Google and run a board update.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={emails}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadEmails} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <EmailRow
            email={item}
            onCreateTask={handleCreateTaskFromEmail}
            creatingTaskId={creatingTaskId}
          />
        )}
      />
    );
  };

  return (
    <View style={styles.container}>
      <TabStrip activeTab={activeTab} onSelect={setActiveTab} />

      {activeTab === 'tasks' && renderTasksTab()}
      {activeTab === 'files' && renderFilesTab()}
      {activeTab === 'emails' && renderEmailsTab()}

      {/* Add Task Modal */}
      <Modal visible={showAddTask} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={[typography.h2, { marginBottom: 16 }]}>Add Task</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Task title"
              placeholderTextColor={colors.textSecondary}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 12, marginBottom: 8 },
              ]}
            >
              Priority
            </Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    newTaskPriority === p && {
                      backgroundColor: PRIORITY_COLORS[p] || colors.primary,
                    },
                  ]}
                  onPress={() => setNewTaskPriority(p)}
                >
                  <Text
                    style={[styles.priorityChipText, newTaskPriority === p && { color: '#fff' }]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setShowAddTask(false);
                  setNewTaskTitle('');
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 17 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalCreate,
                  (!newTaskTitle.trim() || addingTask) && { opacity: 0.5 },
                ]}
                onPress={handleAddTask}
                disabled={!newTaskTitle.trim() || addingTask}
              >
                {addingTask ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  // Tab strip
  tabStrip: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  // Lists
  list: {
    padding: 16,
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
  // Progress
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    color: colors.textSecondary,
    marginBottom: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  // Section headers
  sectionHeader: {
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionHeaderText: {
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Checklist
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    marginTop: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.cardBackground,
    fontSize: 13,
    fontWeight: '700',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    color: colors.textPrimary,
    marginBottom: 4,
  },
  taskTitleDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  priorityText: {
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  dueDateText: {
    color: colors.textSecondary,
  },
  // Drive files
  driveFileRow: {
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
    gap: 12,
  },
  driveFileInfo: {
    flex: 1,
  },
  // Emails
  emailRow: {
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
  emailActions: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 12,
  },
  emailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emailActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal
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
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    textTransform: 'capitalize',
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
  // Attachments
  projectAttachments: {
    marginBottom: 16,
  },
  attachmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  attachmentChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
