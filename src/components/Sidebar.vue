<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import draggable from 'vuedraggable';
import { groupsApi } from '@/api/groups';
import { useNavStore } from '@/stores/navStore';
import { useTagStore } from '@/stores/tagStore';
import type { Group } from '@/types';

// 分组图标定义（实心填充）
const GROUP_ICONS: Record<string, string> = {
  folder:   'M2 6a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V6z',
  server:   'M4 2h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm0 8h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2zm0 8h16a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 012-2z',
  database: 'M12 2C6.5 2 2 4.5 2 7v10c0 2.5 4.5 5 10 5s10-2.5 10-5V7c0-2.5-4.5-5-10-5z',
  cloud:    'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  shield:   'M12 2l8 4v6c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z',
  terminal: 'M2 5l7 7-7 7 2 2 9-9-9-9-2 2zm10 14h8v-3h-8v3z',
  globe:    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z',
  lock:     'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z',
  box:      'M12 2L2 7v10l10 5 10-5V7L12 2z',
  rocket:   'M12 2l3 8h4l-3 4 2 7-6-4-6 4 2-7-3-4h4z',
  code:     'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  layers:   'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5z',
};
const ICON_NAMES = Object.keys(GROUP_ICONS);

function getGroupIconPath(icon: string | null, fallbackId: number): string {
  const name = icon || ICON_NAMES[fallbackId % ICON_NAMES.length];
  return GROUP_ICONS[name] || GROUP_ICONS.folder;
}

const emit = defineEmits<{
  editGroup: [group: Group | null];
  searchServices: [keyword: string];
  deleteGroup: [group: Group];
  filterByTag: [tagValue: string | null];
}>();

const store = useNavStore();
const tagStore = useTagStore();
const searchKeyword = ref('');
const localGroups = ref<Group[]>([]);
const selectedTagFilter = ref<string | null>(null);

// 侧边栏折叠状态
const isCollapsed = ref(false);

// 侧边栏宽度拖拽调整
const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth') || '240'));
const isResizing = ref(false);

function startResize(e: MouseEvent) {
  e.preventDefault();
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  function onMouseMove(e: MouseEvent) {
    const delta = e.clientX - startX;
    sidebarWidth.value = Math.max(180, Math.min(400, startWidth + delta));
  }

  function onMouseUp() {
    isResizing.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('sidebarWidth', String(sidebarWidth.value));
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// 根据当前分组过滤标签
const filteredTags = computed(() => {
  const allTags = tagStore.tags;

  // 全部服务时显示所有标签
  if (store.showAllGroups) {
    return allTags;
  }

  // 获取当前分组服务的标签
  const currentServices = store.currentServices;
  const usedTagValues = new Set<string>();

  currentServices.forEach(service => {
    if (service.tags) {
      service.tags.forEach((tag: string) => usedTagValues.add(tag));
    }
  });

  // 只返回被使用的标签
  return allTags.filter(tag => usedTagValues.has(tag.value));
});

// 同步分组数据
watch(() => store.groups, (newGroups) => {
  localGroups.value = [...newGroups];
}, { immediate: true, deep: true });

// 获取根分组
const rootGroups = computed(() => {
  return localGroups.value.filter(g => !g.parent_id).sort((a, b) => a.sort_order - b.sort_order);
});

// 获取所有服务的总数
const totalCount = computed(() => {
  return store.services.length;
});

// 根据搜索关键词过滤分组
const filteredGroups = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) return rootGroups.value;

  return rootGroups.value.filter(group => {
    // 分组名称匹配
    if (group.name.toLowerCase().includes(keyword)) return true;
    // 分组下的服务名称匹配
    const groupServices = store.services.filter(s => s.group_id === group.id);
    return groupServices.some(s => s.name.toLowerCase().includes(keyword));
  });
});

// 获取第一个分组（折叠状态显示）
const firstGroup = computed(() => rootGroups.value[0] || null);

// 选择分组
function selectGroup(id: number) {
  store.selectGroup(id);
  // 折叠状态下点击分组自动展开
  if (isCollapsed.value) {
    isCollapsed.value = false;
  }
}

// 切换侧边栏折叠
function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value;
}

// 选择全部服务
function selectAllGroups() {
  store.selectAllGroups();
  // 折叠状态下点击自动展开
  if (isCollapsed.value) {
    isCollapsed.value = false;
  }
}

// 拖拽排序后保存
async function onDragEnd() {
  const items = localGroups.value.map((g, i) => ({ id: g.id }));
  try {
    await groupsApi.reorder(items);
    await store.fetchGroups();
  } catch (e) {
    console.error('Failed to reorder:', e);
  }
}

// 搜索 - 同时过滤分组和服务
watch(searchKeyword, (keyword) => {
  emit('searchServices', keyword);
});

// 删除分组（二次确认）
function handleDeleteGroup(group: Group) {
  if (confirm(`确定删除分组「${group.name}」？分组下的所有服务也会被删除。`)) {
    emit('deleteGroup', group);
  }
}

// Toggle tag filter
function toggleTagFilter(tagValue: string) {
  if (selectedTagFilter.value === tagValue) {
    selectedTagFilter.value = null;
    emit('filterByTag', null);
  } else {
    selectedTagFilter.value = tagValue;
    emit('filterByTag', tagValue);
  }
}
</script>

<template>
  <aside
    class="sidebar"
    :class="{ collapsed: isCollapsed, resizing: isResizing }"
    :style="isCollapsed ? {} : { width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px' }"
  >
    <!-- Resize Handle -->
    <div
      v-if="!isCollapsed"
      class="resize-handle"
      :class="{ active: isResizing }"
      @mousedown="startResize"
    ></div>

    <!-- Logo -->
    <div class="sidebar-logo" @click="toggleSidebar" title="点击折叠/展开">
      <div class="logo-icon">
        <svg width="26" height="26" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="12" fill="#000000"></rect>
          <path d="M12 24c0-6 4-10 10-10 3 0 6 1 7.5 3l-3 2.5c-1-1-2.5-1.5-4.5-1.5-3.5 0-6 2.5-6 6s2.5 6 6 6c2 0 3.5-.5 4.5-1.5l3 2.5c-1.5 2-4.5 3-7.5 3-6 0-10-4-10-10z" fill="#ffffff"></path>
        </svg>
      </div>
      <span class="logo-text">Nav Portal</span>
      <svg v-if="!isCollapsed" class="collapse-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </div>

    <!-- 折叠状态：只显示第一个分组的点 -->
    <div v-if="isCollapsed && firstGroup" class="collapsed-group">
      <div
        :class="['group-dot-btn', { active: store.currentGroupId === firstGroup.id }]"
        @click="selectGroup(firstGroup.id)"
        :title="firstGroup.name"
      >
        <span class="group-dot" :style="{ background: firstGroup.color || '#007AFF' }"></span>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="sidebar-search">
      <div class="search-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索分组或服务…"
          class="search-input"
        />
      </div>
    </div>

    <!-- 分组列表 -->
    <div class="sidebar-content">
      <!-- 展开状态：显示分组 -->
      <template v-if="!isCollapsed">
        <!-- 搜索状态：显示过滤后的分组（不可拖拽） -->
        <div v-if="searchKeyword.trim()" class="group-list">
          <div
            v-for="group in filteredGroups"
            :key="group.id"
            class="group-item"
            :class="{ active: store.currentGroupId === group.id }"
            @click="selectGroup(group.id)"
          >
            <div class="group-icon-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path :d="getGroupIconPath(group.icon, group.id)"/>
              </svg>
            </div>
            <span class="group-name">{{ group.name }}</span>
            <span v-if="group.serviceCount !== undefined" class="group-count">{{ group.serviceCount }}</span>
          </div>
          <div v-if="filteredGroups.length === 0" class="empty-state">未找到匹配的分组</div>
        </div>

        <!-- 非搜索状态：显示分组列表 -->
        <div v-else class="group-list">
          <!-- 全部服务 -->
          <div
            class="group-item all-groups-item"
            :class="{ active: store.showAllGroups }"
            @click="selectAllGroups"
          >
            <div class="group-icon-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="2" width="9" height="9" rx="2"/>
                <rect x="13" y="2" width="9" height="9" rx="2"/>
                <rect x="13" y="13" width="9" height="9" rx="2"/>
                <rect x="2" y="13" width="9" height="9" rx="2"/>
              </svg>
            </div>
            <span class="group-name">全部服务</span>
            <span class="group-count">{{ totalCount }}</span>
          </div>

          <!-- 分组列表（可拖拽） -->
          <draggable
            v-model="localGroups"
            item-key="id"
            @end="onDragEnd"
          >
            <template #item="{ element: group }">
              <div v-if="!group.parent_id" :key="group.id" class="group-item-wrapper">
                <div
                  :class="['group-item', { active: store.currentGroupId === group.id && !store.showAllGroups }]"
                  @click="selectGroup(group.id)"
                >
                  <div class="group-icon-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path :d="getGroupIconPath(group.icon, group.id)"/>
                    </svg>
                  </div>
                  <span class="group-name">{{ group.name }}</span>
                  <span v-if="group.serviceCount !== undefined" class="group-count">{{ group.serviceCount }}</span>
                  <div class="group-actions">
                    <button @click.stop="emit('editGroup', group)" class="action-btn" title="编辑">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button @click.stop="handleDeleteGroup(group)" class="action-btn delete" title="删除">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-if="rootGroups.length === 0 && !isCollapsed && !searchKeyword.trim()" class="empty-state">暂无分组</div>
    </div>

    <!-- 新建分组按钮 -->
    <div class="sidebar-add">
      <button @click="emit('editGroup', null)" class="add-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>新建分组</span>
      </button>
    </div>

    <!-- 按标签筛选 -->
    <div v-if="!isCollapsed && filteredTags.length > 0" class="tag-filter-section">
      <div class="tag-filter-header">
        <span>按标签筛选</span>
        <button v-if="selectedTagFilter" @click="selectedTagFilter = null; emit('filterByTag', null)" class="clear-filter-btn">
          清除
        </button>
      </div>
      <div class="tag-filter-list">
        <button
          v-for="tag in filteredTags"
          :key="tag.value"
          @click="toggleTagFilter(tag.value)"
          class="tag-filter-item"
          :class="{ active: selectedTagFilter === tag.value }"
        >
          <span class="tag-filter-name">{{ tag.name }}</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  min-width: 240px;
  height: 100vh;
  background: #ffffff;
  border-right: 1px solid #e5e5e5;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), min-width 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  overflow: hidden;
}

[data-theme="dark"] .sidebar {
  background: #0a0a0a;
  border-right-color: #1a1a1a;
}

.sidebar.collapsed {
  width: 56px;
  min-width: 56px;
}

.sidebar.resizing {
  transition: none !important;
}

/* Resize Handle */
.resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
  transition: background 0.2s;
}

.resize-handle:hover,
.resize-handle.active {
  background: #000000;
  opacity: 0.15;
}

[data-theme="dark"] .resize-handle:hover,
[data-theme="dark"] .resize-handle.active {
  background: #ffffff;
  opacity: 0.1;
}

/* Logo */
.sidebar-logo {
  height: 52px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  cursor: pointer;
}

.sidebar-logo:hover {
  background: #fafafa;
}

[data-theme="dark"] .sidebar-logo:hover {
  background: #111111;
}

.logo-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text {
  font-size: 15px;
  font-weight: 500;
  font-family: 'SF Pro Rounded', system-ui, -apple-system, sans-serif;
  color: #000000;
  letter-spacing: -0.3px;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.2s ease;
}

[data-theme="dark"] .logo-text {
  color: #ffffff;
}

.sidebar.collapsed .logo-text {
  opacity: 0;
  pointer-events: none;
}

.collapse-arrow {
  margin-left: auto;
  color: #a3a3a3;
  flex-shrink: 0;
}

.sidebar.collapsed .collapse-arrow {
  display: none;
}

/* 折叠状态的分组点 */
.collapsed-group {
  display: none;
  justify-content: center;
  padding: 8px 0;
}

.sidebar.collapsed .collapsed-group {
  display: flex;
}

.group-dot-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  cursor: pointer;
}

.group-dot-btn:hover {
  background: #fafafa;
}

[data-theme="dark"] .group-dot-btn:hover {
  background: #111111;
}

.group-dot-btn.active {
  background: #e5e5e5;
}

[data-theme="dark"] .group-dot-btn.active {
  background: #1a1a1a;
}

.group-dot-btn .group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Search */
.sidebar-search {
  padding: 10px 12px;
  flex-shrink: 0;
}

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: #a3a3a3;
}

.search-input {
  width: 100%;
  padding: 7px 12px 7px 34px;
  border: 1px solid #e5e5e5;
  border-radius: 9999px;
  font-size: 13px;
  background: #ffffff;
  color: #000000;
  outline: none;
  font-family: system-ui, -apple-system, sans-serif;
}

.search-input:focus {
  border-color: #d4d4d4;
}

[data-theme="dark"] .search-input {
  background: #111111;
  border-color: #262626;
  color: #ffffff;
}

[data-theme="dark"] .search-input:focus {
  border-color: #404040;
}

.search-input::placeholder {
  color: #a3a3a3;
}

.sidebar.collapsed .sidebar-search {
  opacity: 0;
  pointer-events: none;
}

/* Content */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 8px 12px;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 9999px;
  cursor: pointer;
  color: #525252;
  white-space: nowrap;
  position: relative;
}

.group-item:hover {
  background: #fafafa;
}

[data-theme="dark"] .group-item:hover {
  background: #111111;
}

.group-item.active {
  background: #e5e5e5;
  color: #000000;
}

[data-theme="dark"] .group-item.active {
  background: #262626;
  color: #ffffff;
}

.group-icon-box {
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #fafafa;
  color: #737373;
}

[data-theme="dark"] .group-icon-box {
  background: #1a1a1a;
  color: #a3a3a3;
}

.group-item.active .group-icon-box {
  background: #d4d4d4;
  color: #000000;
}

[data-theme="dark"] .group-item.active .group-icon-box {
  background: #333333;
  color: #ffffff;
}

.all-groups-item {
  margin-bottom: 6px;
  padding-bottom: 7px;
  border-bottom: 1px solid #e5e5e5;
}

[data-theme="dark"] .all-groups-item {
  border-bottom-color: #1a1a1a;
}

.group-name {
  flex: 1;
  font-size: 13px;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.1px;
  font-family: system-ui, -apple-system, sans-serif;
}

.group-item.active .group-name {
  font-weight: 500;
}

.group-count {
  font-size: 11px;
  font-weight: 400;
  padding: 1px 8px;
  border-radius: 9999px;
  background: #fafafa;
  color: #737373;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

[data-theme="dark"] .group-count {
  background: #1a1a1a;
  color: #a3a3a3;
}

.group-item.active .group-count {
  background: #d4d4d4;
  color: #262626;
}

[data-theme="dark"] .group-item.active .group-count {
  background: #333333;
  color: #d4d4d4;
}

.group-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
}

.group-item:hover .group-actions {
  opacity: 1;
}

.action-btn {
  padding: 4px;
  border: none;
  background: none;
  color: #a3a3a3;
  cursor: pointer;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #e5e5e5;
  color: #262626;
}

[data-theme="dark"] .action-btn:hover {
  background: #262626;
  color: #d4d4d4;
}

.action-btn.delete:hover {
  background: #e5e5e5;
  color: #404040;
}

[data-theme="dark"] .action-btn.delete:hover {
  background: #262626;
  color: #a3a3a3;
}

.empty-state {
  text-align: center;
  padding: 32px;
  font-size: 13px;
  color: #a3a3a3;
}

/* Add button */
.sidebar-add {
  padding: 8px 12px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 18px;
  border: 1px solid #e5e5e5;
  background: #ffffff;
  color: #262626;
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  border-radius: 9999px;
  white-space: nowrap;
  font-family: system-ui, -apple-system, sans-serif;
}

.add-btn:hover {
  background: #fafafa;
}

[data-theme="dark"] .add-btn {
  background: #0a0a0a;
  border-color: #262626;
  color: #d4d4d4;
}

[data-theme="dark"] .add-btn:hover {
  background: #111111;
}

.sidebar.collapsed .sidebar-add {
  opacity: 0;
  pointer-events: none;
}

/* Tag Filter Section */
.tag-filter-section {
  padding: 10px 12px;
  border-top: 1px solid #e5e5e5;
  flex-shrink: 0;
}

[data-theme="dark"] .tag-filter-section {
  border-top-color: #1a1a1a;
}

.tag-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #a3a3a3;
  font-family: system-ui, -apple-system, sans-serif;
}

.clear-filter-btn {
  font-size: 11px;
  color: #525252;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 9999px;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 400;
}

.clear-filter-btn:hover {
  background: #e5e5e5;
}

[data-theme="dark"] .clear-filter-btn:hover {
  background: #262626;
}

.tag-filter-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-filter-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid #e5e5e5;
  border-radius: 9999px;
  background: transparent;
  color: #525252;
  font-size: 11px;
  font-weight: 400;
  cursor: pointer;
  font-family: system-ui, -apple-system, sans-serif;
}

.tag-filter-item:hover {
  background: #fafafa;
  border-color: #d4d4d4;
}

[data-theme="dark"] .tag-filter-item {
  border-color: #262626;
  color: #a3a3a3;
}

[data-theme="dark"] .tag-filter-item:hover {
  background: #111111;
  border-color: #333333;
}

.tag-filter-item.active {
  background: #000000;
  border-color: #000000;
  color: #ffffff;
}

[data-theme="dark"] .tag-filter-item.active {
  background: #ffffff;
  border-color: #ffffff;
  color: #000000;
}

.tag-color-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-filter-name {
  white-space: nowrap;
}

/* Scrollbar */
.sidebar-content::-webkit-scrollbar {
  width: 4px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.08);
  border-radius: 9999px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.15);
}

[data-theme="dark"] .sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] .sidebar-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
