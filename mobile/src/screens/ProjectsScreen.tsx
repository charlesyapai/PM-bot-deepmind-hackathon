import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import {
  getProjects,
  createProject,
  getTemplates,
  archiveProject,
  hardDeleteProject,
  restoreProject,
  Project,
  Template,
  TemplateType,
  ProjectStatus,
} from '../services/api';

type RootStackParamList = {
  Projects: undefined;
  ProjectDetail: { projectId: string; projectTitle: string };
};

type ProjectsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Projects'>;
};

type SortMode = 'recent' | 'tasks';
type TabMode = 'active' | 'archived';

const STATUS_COLORS: Record<string, string> = {
  active: colors.success,
  completed: colors.primary,
  archived: colors.textSecondary,
};

const ProjectCard = ({
  project,
  onPress,
  onArchive,
  onDelete,
  onRestore,
  isArchived,
}: {
  project: Project;
  onPress: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  isArchived: boolean;
}) => {
  const statusColor = STATUS_COLORS[project.status] ?? colors.textSecondary;
  const formattedDate = new Date(project.updated_at || project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={[typography.body, styles.cardTitle]} numberOfLines={1}>
          {project.title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{project.status}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={[typography.caption, styles.templateBadge]}>
          {project.template}
        </Text>
        <Text style={[typography.caption, styles.dateText]}>{formattedDate}</Text>
      </View>
      <View style={styles.cardActions}>
        {isArchived ? (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={onRestore}>
              <Text style={[styles.actionBtnText, { color: colors.success }]}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.actionBtn} onPress={onArchive}>
            <Text style={[styles.actionBtnText, { color: colors.warning }]}>Archive</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const ProjectsScreen = ({ navigation }: ProjectsScreenProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabMode>('active');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // Create modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('checklist');
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const status: ProjectStatus = tab === 'archived' ? 'archived' : 'active';
      const data = await getProjects(status);
      setProjects(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load projects.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
      if (data.length > 0) {
        setSelectedTemplate(data[0].type);
      }
    } catch {
      // Templates are optional
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, tab]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProjects(true);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a project title.');
      return;
    }
    setCreating(true);
    try {
      await createProject({
        title: newTitle.trim(),
        template: selectedTemplate,
      });
      setModalVisible(false);
      setNewTitle('');
      setTab('active');
      loadProjects(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project.';
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  };

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

  // Sort projects
  const sortedProjects = [...projects].sort((a, b) => {
    if (sortMode === 'recent') {
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    }
    // 'tasks' — we don't have task counts here, so sort by created_at descending as fallback
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const templateOptions: TemplateType[] =
    templates.length > 0
      ? templates.map((t) => t.type)
      : ['checklist', 'kanban', 'sprint'];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'archived' && styles.tabActive]}
          onPress={() => setTab('archived')}
        >
          <Text style={[styles.tabText, tab === 'archived' && styles.tabTextActive]}>Archived</Text>
        </TouchableOpacity>
      </View>

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Sort:</Text>
        <TouchableOpacity
          style={[styles.sortChip, sortMode === 'recent' && styles.sortChipActive]}
          onPress={() => setSortMode('recent')}
        >
          <Text style={[styles.sortChipText, sortMode === 'recent' && styles.sortChipTextActive]}>Latest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sortMode === 'tasks' && styles.sortChipActive]}
          onPress={() => setSortMode('tasks')}
        >
          <Text style={[styles.sortChipText, sortMode === 'tasks' && styles.sortChipTextActive]}>Created</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={[typography.body, styles.errorText]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadProjects()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedProjects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={sortedProjects.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[typography.body, styles.emptyText]}>
                {tab === 'archived'
                  ? 'No archived projects.'
                  : 'No projects yet. Tap + to create one.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              isArchived={tab === 'archived'}
              onPress={() =>
                navigation.navigate('ProjectDetail', {
                  projectId: item.id,
                  projectTitle: item.title,
                })
              }
              onArchive={() => handleArchive(item)}
              onDelete={() => handleHardDelete(item)}
              onRestore={() => handleRestore(item)}
            />
          )}
        />
      )}

      {/* Create Project Modal */}
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
            <Text style={[typography.body, styles.modalTitle]}>New Project</Text>
            <TouchableOpacity onPress={handleCreate} disabled={creating}>
              {creating ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[typography.body, styles.modalDone]}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={[typography.caption, styles.inputLabel]}>Project Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Q2 Planning"
              placeholderTextColor={colors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              editable={!creating}
            />

            <Text style={[typography.caption, styles.inputLabel]}>Template</Text>
            <View style={styles.templatePicker}>
              {templateOptions.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.templateChip,
                    selectedTemplate === type && styles.templateChipSelected,
                  ]}
                  onPress={() => setSelectedTemplate(type)}
                  disabled={creating}
                >
                  <Text
                    style={[
                      typography.caption,
                      styles.templateChipText,
                      selectedTemplate === type && styles.templateChipTextSelected,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  // Tab bar
  tabBar: {
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
  // Sort bar
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  sortLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortChipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // List
  list: {
    padding: 16,
    gap: 12,
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
  headerButton: {
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '300',
    lineHeight: 32,
  },
  // Card
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.cardBackground,
    textTransform: 'capitalize',
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateBadge: {
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  dateText: {
    color: colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
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
  templatePicker: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  templateChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.cardBackground,
  },
  templateChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  templateChipText: {
    color: colors.textSecondary,
  },
  templateChipTextSelected: {
    color: colors.cardBackground,
    fontWeight: '600',
  },
});
