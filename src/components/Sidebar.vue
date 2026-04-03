<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import draggable from 'vuedraggable';
import { groupsApi } from '@/api/groups';
import { tagsApi, type Tag } from '@/api/tags';
import { useNavStore } from '@/stores/navStore';
import { useAuthStore } from '@/stores/authStore';
import type { Group } from '@/types';

const emit = defineEmits<{
  editGroup: [group: Group | null];
  searchServices: [keyword: string];
  deleteGroup: [group: Group];
  showExport: [];
  importData: [file: File];
  filterByTag: [tagValue: string | null];
}>();

const store = useNavStore();
const authStore = useAuthStore();
const searchKeyword = ref('');
const localGroups = ref<Group[]>([]);
const allTags = ref<Tag[]>([]);
const selectedTagFilter = ref<string | null>(null);

// 侧边栏折叠状态
const isCollapsed = ref(false);

// Load tags on mount
onMounted(async () => {
  try {
    const res = await tagsApi.getAll();
    allTags.value = res.data || [];
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
});

// 根据当前分组过滤标签
const filteredTags = computed(() => {
  // 全部服务时显示所有标签
  if (store.showAllGroups) {
    return allTags.value;
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
  return allTags.value.filter(tag => usedTagValues.has(tag.value));
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

// 导入数据
function handleImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    emit('importData', file);
  }
  input.value = '';
}

// 退出登录
function handleLogout() {
  if (confirm('确定退出登录吗？')) {
    authStore.logout();
    window.location.reload();
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
    :class="{ collapsed: isCollapsed }"
  >
    <!-- Logo -->
    <div class="sidebar-logo" @click="toggleSidebar" title="点击折叠/展开">
      <div class="logo-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
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
        <span class="group-dot" :style="{ background: firstGroup.color || '#3b6ef8' }"></span>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="sidebar-search">
      <div class="search-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
        <div class="sidebar-header">
          <span>分组</span>
          <button @click="toggleSidebar" class="collapse-btn" title="最小化">−</button>
        </div>

        <!-- 搜索状态：显示过滤后的分组（不可拖拽） -->
        <div v-if="searchKeyword.trim()" class="group-list">
          <div
            v-for="group in filteredGroups"
            :key="group.id"
            class="group-item"
            :class="{ active: store.currentGroupId === group.id }"
            :style="store.currentGroupId === group.id ? { background: (group.color || '#3b6ef8') + '12' } : {}"
            @click="selectGroup(group.id)"
          >
            <span class="group-dot" :style="{ background: group.color || '#3b6ef8' }"></span>
            <span class="group-name" :style="store.currentGroupId === group.id ? { color: group.color || '#3b6ef8' } : {}">{{ group.name }}</span>
            <span v-if="group.serviceCount !== undefined" class="group-count" :style="store.currentGroupId === group.id ? { background: (group.color || '#3b6ef8') + '20', color: group.color || '#3b6ef8' } : {}">{{ group.serviceCount }}</span>
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
            <svg class="group-dot-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
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
                  :style="store.currentGroupId === group.id && !store.showAllGroups ? { background: (group.color || '#3b6ef8') + '12' } : {}"
                  @click="selectGroup(group.id)"
                >
                  <span class="group-dot" :style="{ background: group.color || '#3b6ef8' }"></span>
                  <span class="group-name" :style="store.currentGroupId === group.id && !store.showAllGroups ? { color: group.color || '#3b6ef8' } : {}">{{ group.name }}</span>
                  <span v-if="group.serviceCount !== undefined" class="group-count" :style="store.currentGroupId === group.id && !store.showAllGroups ? { background: (group.color || '#3b6ef8') + '20', color: group.color || '#3b6ef8' } : {}">{{ group.serviceCount }}</span>
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
          :style="selectedTagFilter === tag.value ? { background: tag.color + '15', borderColor: tag.color, color: tag.color } : {}"
        >
          <span class="tag-color-dot" :style="{ background: tag.color }"></span>
          <span class="tag-filter-name">{{ tag.name }}</span>
        </button>
      </div>
    </div>

    <!-- 底部栏 -->
    <div class="sidebar-footer">
      <label class="footer-btn import-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span>导入</span>
        <input type="file" accept=".json" style="display: none" @change="handleImport">
      </label>
      <button @click="$emit('showExport')" class="footer-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>导出</span>
      </button>
      <button @click="handleLogout" class="footer-btn logout-btn" title="退出登录">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span>退出</span>
      </button>
      <!-- 折叠状态的展开按钮 -->
      <button @click="toggleSidebar" class="expand-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  min-width: 220px;
  height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease, min-width 0.25s ease;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 52px;
  min-width: 52px;
}

/* Logo */
.sidebar-logo {
  height: 52px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.15s;
}

.sidebar-logo:hover {
  background: var(--surface2);
}

.logo-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, #3b6ef8, #5585fa);
}

.logo-text {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.2px;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.15s ease;
}

.sidebar.collapsed .logo-text {
  opacity: 0;
  pointer-events: none;
}

.collapse-arrow {
  margin-left: auto;
  color: var(--text3);
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
  border-bottom: 1px solid var(--border);
}

.sidebar.collapsed .collapsed-group {
  display: flex;
}

.group-dot-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.group-dot-btn:hover {
  background: var(--surface2);
}

.group-dot-btn.active {
  background: var(--accent-bg);
}

.group-dot-btn .group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Search */
.sidebar-search {
  padding: 12px;
  flex-shrink: 0;
}

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--text3);
}

.search-input {
  width: 100%;
  padding: 6px 10px 6px 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  background: var(--surface2);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: var(--accent);
}

.sidebar.collapsed .sidebar-search {
  opacity: 0;
  pointer-events: none;
}

/* Header */
.sidebar-header {
  padding: 8px 16px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  white-space: nowrap;
}

.collapse-btn {
  font-size: 12px;
  color: var(--text3);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.collapse-btn:hover {
  background: var(--surface2);
  color: var(--text2);
}

.sidebar.collapsed .sidebar-header {
  opacity: 0;
  pointer-events: none;
}

/* Content */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 8px 12px;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text2);
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.group-item:hover {
  background: var(--surface2);
}

.group-item.active {
  background: var(--accent-bg);
  color: var(--accent);
}

.group-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-dot-icon {
  color: var(--text3);
  flex-shrink: 0;
}

.all-groups-item .group-dot-icon {
  color: var(--accent);
}

.all-groups-item {
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}

.group-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-item.active .group-name {
  font-weight: 600;
  color: var(--accent);
}

.group-count {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--surface2);
  color: var(--text3);
}

.group-item.active .group-count {
  background: rgba(59, 110, 248, 0.15);
  color: var(--accent);
}

.group-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.group-item:hover .group-actions {
  opacity: 1;
}

.action-btn {
  padding: 4px;
  border: none;
  background: none;
  color: var(--text3);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.action-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.action-btn.delete:hover {
  background: var(--red-bg);
  color: var(--red);
}

.empty-state {
  text-align: center;
  padding: 32px;
  font-size: 13px;
  color: var(--text3);
}

/* Add button */
.sidebar-add {
  padding: 8px 12px;
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: none;
  color: var(--text3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.add-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.sidebar.collapsed .sidebar-add {
  opacity: 0;
  pointer-events: none;
}

/* Tag Filter Section */
.tag-filter-section {
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.tag-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text3);
}

.clear-filter-btn {
  font-size: 11px;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
  text-transform: none;
  letter-spacing: normal;
}

.clear-filter-btn:hover {
  background: var(--accent-bg);
}

.tag-filter-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-filter-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text2);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.tag-filter-item:hover {
  background: var(--surface2);
  border-color: var(--border2);
}

.tag-filter-item.active {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
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

/* Footer */
.sidebar-footer {
  height: 52px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 0 8px;
  background: rgba(240, 241, 244, 0.85);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  background: none;
  color: var(--text3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.footer-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.import-btn {
  cursor: pointer;
}

.logout-btn:hover {
  background: var(--red-bg);
  color: var(--red);
}

.expand-btn {
  display: none;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--text3);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}

.expand-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.sidebar.collapsed .footer-btn {
  display: none;
}

.sidebar.collapsed .expand-btn {
  display: flex;
}

/* Scrollbar */
.sidebar-content::-webkit-scrollbar {
  width: 4px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: var(--border2);
  border-radius: 4px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: #c4c7d0;
}
</style>