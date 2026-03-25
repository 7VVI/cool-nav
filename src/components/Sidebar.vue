<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import draggable from 'vuedraggable';
import { useNavStore } from '@/stores/navStore';
import type { Group } from '@/types';

const emit = defineEmits<{
  (e: 'editGroup', group: Group | null): void;
  (e: 'searchServices', query: string): void;
}>();

const navStore = useNavStore();

// Search state
const searchQuery = ref('');

// Tree expansion state
const expandedGroups = ref<Set<number>>(new Set());

// Local draggable list
const localGroups = ref<Group[]>([]);

// Keep localGroups in sync with store groups
watch(
  () => navStore.groups,
  (newGroups) => {
    localGroups.value = [...newGroups];
  },
  { immediate: true, deep: true }
);

// Build tree structure from flat list
const rootGroups = computed(() => {
  const groups = localGroups.value.filter(g => !g.parent_id);
  return buildTree(groups);
});

function buildTree(parentGroups: Group[]): Array<Group & { children: Group[] }> {
  return parentGroups.map(group => {
    const children = localGroups.value.filter(g => g.parent_id === group.id);
    return {
      ...group,
      children: buildTree(children)
    };
  });
}

// Filter groups by search query
const filteredGroups = computed(() => {
  if (!searchQuery.value.trim()) {
    return rootGroups.value;
  }
  return filterGroups(rootGroups.value, searchQuery.value.toLowerCase());
});

function filterGroups(groups: Array<Group & { children: Group[] }>, query: string): Array<Group & { children: Group[] }> {
  return groups.reduce((acc, group) => {
    const matchesQuery = group.name.toLowerCase().includes(query);
    const filteredChildren = filterGroups(group.children, query);

    if (matchesQuery || filteredChildren.length > 0) {
      acc.push({
        ...group,
        children: filteredChildren
      });
    }
    return acc;
  }, [] as Array<Group & { children: Group[] }>);
}

// Toggle group expansion
function toggleGroup(groupId: number) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId);
  } else {
    expandedGroups.value.add(groupId);
  }
}

function isExpanded(groupId: number): boolean {
  return expandedGroups.value.has(groupId);
}

// Handle group selection
function selectGroup(groupId: number) {
  navStore.selectGroup(groupId);
}

// Check if group is currently selected
function isSelected(groupId: number): boolean {
  return navStore.currentGroupId === groupId;
}

// Handle add group
function handleAddGroup(parentId?: number) {
  emit('editGroup', null);
}

// Handle edit group
function handleEditGroup(group: Group) {
  emit('editGroup', group);
}

// Handle search input
function handleSearch() {
  emit('searchServices', searchQuery.value);
}

// Handle drag end - save new order
async function handleDragEnd() {
  const items = localGroups.value.map((g, index) => ({ id: g.id, sort_order: index }));
  // Update local sort order
  localGroups.value.forEach((group, index) => {
    group.sort_order = index;
  });
  // The actual API call to persist order would go here
  // For now we just update locally
}

// Get service count for a group
function getServiceCount(group: Group): number {
  return (group as any).serviceCount || 0;
}

// Expand all on mount
watch(
  () => navStore.groups,
  () => {
    // Auto-expand groups that have children
    navStore.groups.forEach(group => {
      if (group.parent_id === null) {
        const hasChildren = navStore.groups.some(g => g.parent_id === group.id);
        if (hasChildren) {
          expandedGroups.value.add(group.id);
        }
      }
    });
  },
  { immediate: true }
);
</script>

<template>
  <aside class="sidebar">
    <!-- Header with search and add button -->
    <div class="sidebar-header">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search groups..."
          class="search-input"
          @input="handleSearch"
        />
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <button class="add-btn" @click="handleAddGroup()" title="Add Group">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>

    <!-- Group tree list -->
    <div class="group-list">
      <draggable
        :list="localGroups"
        item-key="id"
        handle=".drag-handle"
        ghost-class="ghost"
        animation="200"
        @end="handleDragEnd"
      >
        <template #item="{ element: group }">
          <div v-if="!group.parent_id" class="group-item-wrapper">
            <GroupItem
              :group="group"
              :children="localGroups.filter(g => g.parent_id === group.id)"
              :is-expanded="isExpanded(group.id)"
              :is-selected="isSelected(group.id)"
              :service-count="getServiceCount(group)"
              @toggle="toggleGroup"
              @select="selectGroup"
              @edit="handleEditGroup"
              @add-child="handleAddGroup"
            />
          </div>
        </template>
      </draggable>

      <!-- Empty state -->
      <div v-if="filteredGroups.length === 0" class="empty-state">
        <p v-if="searchQuery">No groups match your search</p>
        <p v-else>No groups yet. Add your first group!</p>
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
// Nested component for group item with children
import { defineComponent, PropType } from 'vue';
import type { Group } from '@/types';

const GroupItem = defineComponent({
  name: 'GroupItem',
  props: {
    group: {
      type: Object as PropType<Group>,
      required: true
    },
    children: {
      type: Array as PropType<Group[]>,
      default: () => []
    },
    isExpanded: {
      type: Boolean,
      default: false
    },
    isSelected: {
      type: Boolean,
      default: false
    },
    serviceCount: {
      type: Number,
      default: 0
    }
  },
  emits: ['toggle', 'select', 'edit', 'addChild'],
  setup(props, { emit }) {
    const handleToggle = () => {
      emit('toggle', props.group.id);
    };

    const handleSelect = () => {
      emit('select', props.group.id);
    };

    const handleEdit = (e: Event) => {
      e.stopPropagation();
      emit('edit', props.group);
    };

    const handleAddChild = (e: Event) => {
      e.stopPropagation();
      emit('addChild', props.group.id);
    };

    return {
      handleToggle,
      handleSelect,
      handleEdit,
      handleAddChild
    };
  },
  template: `
    <div class="group-item" :class="{ selected: isSelected }">
      <div class="group-content">
        <!-- Drag handle -->
        <div class="drag-handle">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="2"></circle>
            <circle cx="15" cy="6" r="2"></circle>
            <circle cx="9" cy="12" r="2"></circle>
            <circle cx="15" cy="12" r="2"></circle>
            <circle cx="9" cy="18" r="2"></circle>
            <circle cx="15" cy="18" r="2"></circle>
          </svg>
        </div>

        <!-- Expand/collapse toggle -->
        <button
          v-if="children.length > 0"
          class="expand-btn"
          @click.stop="handleToggle"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            :class="{ rotated: isExpanded }"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <div v-else class="expand-placeholder"></div>

        <!-- Group name -->
        <span class="group-name" @click="handleSelect">
          {{ group.name }}
        </span>

        <!-- Service count badge -->
        <span v-if="serviceCount > 0" class="service-count">
          {{ serviceCount }}
        </span>

        <!-- Action buttons -->
        <div class="group-actions">
          <button class="action-btn" @click="handleAddChild" title="Add child group">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button class="action-btn" @click="handleEdit" title="Edit group">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Children -->
      <div v-if="isExpanded && children.length > 0" class="group-children">
        <GroupItem
          v-for="child in children"
          :key="child.id"
          :group="child"
          :children="[]"
          :is-selected="isSelected"
          :service-count="serviceCount"
          @toggle="$emit('toggle', $event)"
          @select="$emit('select', $event)"
          @edit="$emit('edit', $event)"
          @add-child="$emit('addChild', $event)"
        />
      </div>
    </div>
  `
});

export default {
  components: { GroupItem }
};
</script>

<style scoped>
.sidebar {
  width: 280px;
  height: 100vh;
  background: #1e1e2e;
  border-right: 1px solid #313244;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #313244;
  display: flex;
  gap: 8px;
}

.search-box {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 6px;
  color: #cdd6f4;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #89b4fa;
}

.search-input::placeholder {
  color: #6c7086;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c7086;
  pointer-events: none;
}

.add-btn {
  padding: 8px;
  background: #89b4fa;
  border: none;
  border-radius: 6px;
  color: #1e1e2e;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.add-btn:hover {
  background: #b4befe;
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.group-item-wrapper {
  margin-bottom: 2px;
}

.group-item {
  border-radius: 6px;
  transition: background 0.15s;
}

.group-item.selected > .group-content {
  background: #313244;
}

.group-content {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  gap: 8px;
  border-radius: 6px;
  cursor: pointer;
}

.group-content:hover {
  background: #313244;
}

.drag-handle {
  cursor: grab;
  color: #6c7086;
  display: flex;
  align-items: center;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.drag-handle:hover {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.expand-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: #6c7086;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.expand-btn:hover {
  color: #cdd6f4;
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-btn svg.rotated {
  transform: rotate(90deg);
}

.expand-placeholder {
  width: 16px;
}

.group-name {
  flex: 1;
  font-size: 14px;
  color: #cdd6f4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-count {
  font-size: 12px;
  color: #6c7086;
  background: #45475a;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.group-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.group-content:hover .group-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #6c7086;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
}

.action-btn:hover {
  color: #cdd6f4;
  background: #45475a;
}

.group-children {
  margin-left: 20px;
  padding-left: 10px;
  border-left: 1px solid #45475a;
}

.ghost {
  opacity: 0.5;
  background: #89b4fa;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c7086;
  font-size: 14px;
}
</style>