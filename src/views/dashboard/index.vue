<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import draggable from 'vuedraggable';
import { useNavStore } from '@/stores/navStore';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTagStore } from '@/stores/tagStore';
import { useTodoStore } from '@/stores/todoStore';
import { servicesApi } from '@/api/services';
import { groupsApi } from '@/api/groups';
import Sidebar from '@/components/Sidebar.vue';
import ServiceCard from '@/components/ServiceCard.vue';
import ServiceListRow from '@/components/ServiceListRow.vue';
import ServiceModal from '@/components/ServiceModal.vue';
import GroupModal from '@/components/GroupModal.vue';
import ExportModal from '@/components/ExportModal.vue';
import type { Group, Service, Todo } from '@/types';

const store = useNavStore();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const tagStore = useTagStore();

// Modal states
const showServiceModal = ref(false);
const showGroupModal = ref(false);
const showExportModal = ref(false);
const editingService = ref<Service | null>(null);
const editingGroup = ref<Group | null>(null);

// Search state
const searchKeyword = ref('');
const searchResults = ref<Service[]>([]);
const isSearching = ref(false);

// Tag filter state
const tagFilter = ref<string | null>(null);

// Selection mode
const selectMode = ref(false);
const selectedServices = ref<Set<number>>(new Set());

// View mode state
const viewMode = ref<'card' | 'list'>('card');

// Local draggable list for services
const localServices = ref<Service[]>([]);

// Computed: display services (search results or current group services, filtered by tag)
const displayServices = computed(() => {
  let services: Service[];

  if (searchKeyword.value.trim()) {
    services = searchResults.value;
  } else {
    services = localServices.value;
  }

  // Filter by tag if selected
  if (tagFilter.value) {
    services = services.filter(s => s.tags && s.tags.includes(tagFilter.value!));
  }

  return services;
});

// Watch current services to sync with local
watch(
  () => store.currentServices,
  (newServices, oldServices) => {
    if (searchKeyword.value.trim()) return;

    // 如果服务数量变化（新增/删除），重新赋值
    if (newServices.length !== localServices.value.length) {
      localServices.value = [...newServices];
      return;
    }

    // 如果是编辑单个服务，只更新数据，保持排序
    const newIds = new Set(newServices.map(s => s.id));
    const localIds = new Set(localServices.value.map(s => s.id));

    // ID集合相同时，只更新数据，保持排序
    if (newIds.size === localIds.size && [...newIds].every(id => localIds.has(id))) {
      localServices.value = localServices.value.map(localService => {
        const updated = newServices.find(s => s.id === localService.id);
        return updated || localService;
      });
    } else {
      // ID变化（切换分组等情况），重新赋值
      localServices.value = [...newServices];
    }
  },
  { immediate: true, deep: true }
);

// Clear selection when group changes
watch(
  () => store.currentGroupId,
  (id) => {
    selectedServices.value.clear();
    selectMode.value = false;
    tagFilter.value = null;
    // Read view preference from group
    if (id) {
      const group = store.groups.find(g => g.id === id);
      viewMode.value = (group?.view_mode as 'card' | 'list') || 'card';
    }
  },
  { immediate: true }
);

// Switch view mode
async function setViewMode(mode: 'card' | 'list') {
  viewMode.value = mode;
  if (store.currentGroupId) {
    try {
      await groupsApi.updateViewMode(store.currentGroupId, mode);
      // Update local store
      const group = store.groups.find(g => g.id === store.currentGroupId);
      if (group) {
        group.view_mode = mode;
      }
    } catch (error) {
      console.error('Failed to update view mode:', error);
    }
  }
}

// Handle tag filter from Sidebar
function handleFilterByTag(tagValue: string | null) {
  tagFilter.value = tagValue;
}

// Toggle selection mode
function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  if (!selectMode.value) {
    selectedServices.value.clear();
  }
}

// Toggle service selection
function toggleServiceSelection(service: Service) {
  if (selectedServices.value.has(service.id)) {
    selectedServices.value.delete(service.id);
  } else {
    selectedServices.value.add(service.id);
  }
}

// Select all services
function selectAllServices() {
  displayServices.value.forEach(s => selectedServices.value.add(s.id));
}

// Clear selection
function clearSelection() {
  selectedServices.value.clear();
}

// Export selected services
async function exportSelectedServices() {
  if (selectedServices.value.size === 0) {
    alert('请选择要导出的服务');
    return;
  }

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ serviceIds: Array.from(selectedServices.value) })
    });

    if (!res.ok) {
      throw new Error('Export failed');
    }

    const data = await res.json();

    if (data.success) {
      const blob = new Blob([data.data.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.data.filename || 'export.md';
      a.click();
      URL.revokeObjectURL(url);
      selectedServices.value.clear();
      selectMode.value = false;
    }
  } catch (e) {
    console.error('Export failed:', e);
    alert('导出失败');
  }
}

// Handle group edit from Sidebar
function handleEditGroup(group: Group | null) {
  editingGroup.value = group;
  showGroupModal.value = true;
}

// Handle delete group from Sidebar
async function handleDeleteGroup(group: Group) {
  try {
    await store.deleteGroup(group.id);
  } catch (error) {
    console.error('Failed to delete group:', error);
  }
}

// Handle search from Sidebar
async function handleSearchServices(query: string) {
  searchKeyword.value = query;
  if (query.trim()) {
    isSearching.value = true;
    try {
      const res = await servicesApi.search(query.trim());
      searchResults.value = res.data || [];
    } catch (error) {
      console.error('Search failed:', error);
      searchResults.value = [];
    } finally {
      isSearching.value = false;
    }
  } else {
    searchResults.value = [];
  }
}

// Handle service edit from ServiceCard
function handleEditService(service: Service) {
  editingService.value = service;
  showServiceModal.value = true;
}

// Handle delete service
async function handleDeleteService(service: Service) {
  try {
    await store.deleteService(service.id);
  } catch (error) {
    console.error('Failed to delete service:', error);
  }
}

// Handle add service button
function handleAddService() {
  editingService.value = null;
  showServiceModal.value = true;
}

// Handle drag end - update sort order
async function handleDragEnd() {
  if (searchKeyword.value.trim()) {
    return;
  }

  const items = localServices.value.map((service, index) => ({
    id: service.id,
    group_id: service.group_id,
    sort_order: index
  }));

  try {
    await servicesApi.reorder(items.map(({ id, group_id }) => ({ id, group_id })));
  } catch (error) {
    console.error('Failed to update sort order:', error);
    localServices.value = [...store.currentServices];
  }
}

// Initialize data on mount
onMounted(() => {
  store.fetchGroups();
  tagStore.fetchTags();
});

// Handle import from file input
function handleImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    importData(file);
  }
  input.value = '';
}

// Import data
async function importData(file: File) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.groups && data.services) {
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authStore.token}`
          },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
          await store.fetchGroups();
          alert('导入成功');
        } else {
          alert(result.message || '导入失败');
        }
      } else {
        alert('文件格式错误');
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert('导入失败');
    }
  };
  reader.readAsText(file);
}

// Handle logout
function handleLogout() {
  if (confirm('确定退出登录吗？')) {
    authStore.logout();
    window.location.reload();
  }
}

// ============ Page Navigation ============
const currentPage = ref<'services' | 'todos' | 'notes'>((localStorage.getItem('currentPage') as any) || 'services');

watch(currentPage, (page) => {
  localStorage.setItem('currentPage', page);
});

// ============ Notes Feature ============
const noteUrl = ref(localStorage.getItem('noteUrl') || '');
const noteUrlInput = ref('');
const noteUrlKey = ref(0);
const showNoteInput = ref(false);

function saveNoteUrl() {
  const url = noteUrlInput.value.trim();
  if (!url) return;
  noteUrl.value = url;
  localStorage.setItem('noteUrl', url);
  noteUrlKey.value++;
  showNoteInput.value = false;
}

function clearNoteUrl() {
  noteUrl.value = '';
  noteUrlInput.value = '';
  localStorage.removeItem('noteUrl');
}

function openNoteInput() {
  noteUrlInput.value = noteUrl.value;
  showNoteInput.value = true;
}

// ============ Todo Feature ============
const todoStore = useTodoStore();

const todoFilter = ref<'all' | 'high' | 'medium' | 'low'>('all');
const showTodoModal = ref(false);
const editingTodoId = ref<number | null>(null);
const todoForm = ref({ title: '', desc: '', priority: 'medium' as const, tag: '运维' });
const todoFormError = ref('');

const TODO_TAGS = ['运维', '安全', '部署', '排查', '优化'];

// Custom tag state
const customTagInput = ref('');
const showTagSuggestions = ref(false);
const tagSuggestions = computed(() => {
  const input = customTagInput.value.trim().toLowerCase();
  if (!input) return [];
  // Existing tags used in todos
  const usedTags = new Set(todoStore.todos.map(t => t.tag).filter(Boolean));
  const presetSet = new Set(TODO_TAGS);
  const allKnown = [...new Set([...TODO_TAGS, ...usedTags])];
  return allKnown.filter(t => t.toLowerCase().includes(input)).slice(0, 5);
});

const filteredTodos = computed(() => {
  if (todoFilter.value === 'all') return todoStore.todos;
  return todoStore.todos.filter(t => t.priority === todoFilter.value);
});

const todoStats = computed(() => {
  const all = todoStore.todos;
  return {
    todo: all.filter(t => t.status === 'todo').length,
    doing: all.filter(t => t.status === 'doing').length,
    done: all.filter(t => t.status === 'done').length,
    total: all.length,
    progress: all.length > 0 ? Math.round(all.filter(t => t.status === 'done').length / all.length * 100) : 0
  };
});

// Local mutable lists per column for draggable
const todoList = ref<Todo[]>([]);
const doingList = ref<Todo[]>([]);
const doneList = ref<Todo[]>([]);

function syncTodoLists() {
  todoList.value = filteredTodos.value.filter(t => t.status === 'todo');
  doingList.value = filteredTodos.value.filter(t => t.status === 'doing');
  doneList.value = filteredTodos.value.filter(t => t.status === 'done');
}

watch(filteredTodos, syncTodoLists, { immediate: true });

function getColumnList(status: string) {
  if (status === 'todo') return todoList.value;
  if (status === 'doing') return doingList.value;
  return doneList.value;
}

// Handle drag between columns
async function handleTodoDragEnd(evt: any, _list: Todo[]) {
  const item = evt.item.__draggable_context?.element as Todo | undefined;
  if (!item) return;
  // Find which column the item ended up in by checking its new parent
  const newStatus = evt.to?.dataset?.status as Todo['status'] | undefined;
  if (newStatus && newStatus !== item.status) {
    await todoStore.moveTodo(item.id, newStatus);
  }
}

async function handleMoveTodo(id: number, newStatus: Todo['status']) {
  await todoStore.moveTodo(id, newStatus);
}

function hideTagSuggestions() {
  setTimeout(() => { showTagSuggestions.value = false; }, 150);
}

async function handleDeleteTodo(id: number) {
  await todoStore.deleteTodo(id);
}

function openTodoModal() {
  editingTodoId.value = null;
  todoForm.value = { title: '', desc: '', priority: 'medium', tag: '' };
  customTagInput.value = '';
  showTagSuggestions.value = false;
  todoFormError.value = '';
  showTodoModal.value = true;
}

function openEditTodoModal(todo: Todo) {
  editingTodoId.value = todo.id;
  todoForm.value = { title: todo.title, desc: todo.desc, priority: todo.priority, tag: todo.tag };
  customTagInput.value = todo.tag;
  showTagSuggestions.value = false;
  todoFormError.value = '';
  showTodoModal.value = true;
}

async function handleSaveTodo() {
  if (!todoForm.value.title.trim()) {
    todoFormError.value = '请输入标题';
    return;
  }
  if (editingTodoId.value) {
    await todoStore.updateTodo(editingTodoId.value, {
      title: todoForm.value.title.trim(),
      desc: todoForm.value.desc.trim(),
      priority: todoForm.value.priority,
      tag: todoForm.value.tag,
    });
  } else {
    await todoStore.addTodo({
      title: todoForm.value.title.trim(),
      desc: todoForm.value.desc.trim(),
      priority: todoForm.value.priority,
      tag: todoForm.value.tag,
      status: 'todo'
    });
  }
  showTodoModal.value = false;
}

// Load todos when page is todos (including on refresh)
watch(currentPage, (page) => {
  if (page === 'todos') todoStore.fetchTodos();
}, { immediate: true });

const TAG_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF',
  '#5856D6', '#AF52DE', '#FF2D55', '#00C7BE', '#FF6482',
  '#5AC8FA', '#64D2FF', '#BF5AF2', '#FFD60A',
];
function getTagColor(tag: string) {
  if (!tag) return '#8E8E93';
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

const CARD_ACCENT_COLORS = [
  ['#FF3B30', '#FF6482'], ['#FF9500', '#FFCC00'], ['#FFD60A', '#FF9F0A'],
  ['#34C759', '#30D158'], ['#007AFF', '#5AC8FA'], ['#5856D6', '#AF52DE'],
  ['#FF2D55', '#BF5AF2'], ['#00C7BE', '#64D2FF'], ['#5AC8FA', '#34C759'],
  ['#FF6482', '#FF9500'], ['#AF52DE', '#FF2D55'], ['#32ADE6', '#5856D6'],
];

function getCardGradient(id: number) {
  const [c1, c2] = CARD_ACCENT_COLORS[id % CARD_ACCENT_COLORS.length];
  return `linear-gradient(90deg, ${c1}, ${c2})`;
}

function formatTodoTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (isToday) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<template>
  <div class="flex h-screen" style="background: var(--bg)">
    <!-- Sidebar (only on services page) -->
    <Sidebar
      v-show="currentPage === 'services'"
      @editGroup="handleEditGroup"
      @searchServices="handleSearchServices"
      @deleteGroup="handleDeleteGroup"
      @filterByTag="handleFilterByTag"
    />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- Top Tab Bar -->
      <header class="topbar">
        <div class="topbar-logo" v-if="currentPage !== 'services'">
          <div class="topbar-logo-icon">
            <svg width="14" height="14" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="48" rx="12" fill="#000000"></rect>
              <path d="M12 24c0-6 4-10 10-10 3 0 6 1 7.5 3l-3 2.5c-1-1-2.5-1.5-4.5-1.5-3.5 0-6 2.5-6 6s2.5 6 6 6c2 0 3.5-.5 4.5-1.5l3 2.5c-1.5 2-4.5 3-7.5 3-6 0-10-4-10-10z" fill="#ffffff"></path>
            </svg>
          </div>
          <span class="topbar-logo-text">Nav Portal</span>
        </div>

        <nav class="topbar-tabs">
          <button class="topbar-tab" :class="{ active: currentPage === 'services' }" @click="currentPage = 'services'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg>
            <span>服务管理</span>
          </button>
          <button class="topbar-tab" :class="{ active: currentPage === 'todos' }" @click="currentPage = 'todos'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>待办清单</span>
            <span v-if="todoStats.todo > 0" class="tab-badge todo">{{ todoStats.todo }}</span>
          </button>
          <button class="topbar-tab" :class="{ active: currentPage === 'notes' }" @click="currentPage = 'notes'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>日志笔记</span>
          </button>
        </nav>

        <div class="topbar-right">
          <button @click="themeStore.toggle()" class="topbar-icon-btn" :title="themeStore.effectiveTheme === 'dark' ? '切换到亮色' : '切换到暗色'">
            <svg v-if="themeStore.effectiveTheme === 'dark'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button @click="handleLogout" class="topbar-icon-btn" title="退出登录">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      <!-- ==================== Services Page ==================== -->
      <template v-if="currentPage === 'services'">
      <!-- Service Sub-Header -->
      <div
        class="flex items-center justify-between px-6 border-b flex-shrink-0"
        style="height: 44px; background: var(--surface); border-color: var(--border)"
      >
        <div class="flex items-center gap-3">
          <h1 class="text-[14px] font-semibold" style="color: var(--text); letter-spacing: -0.2px">
            {{ searchKeyword.trim() ? `搜索: ${searchKeyword}` : (tagFilter ? `标签筛选` : (store.showAllGroups ? '全部服务' : (store.currentGroup?.name || '请选择分组'))) }}
          </h1>
          <span class="text-[11px] font-medium px-2 py-0.5 rounded-full" style="background: var(--surface2); color: var(--text3)">
            {{ displayServices.length }}
          </span>
          <span v-if="selectMode && selectedServices.size > 0" class="text-[11px] font-medium px-2 py-0.5 rounded-full" style="background: var(--accent); color: white">
            已选 {{ selectedServices.size }}
          </span>
          <span v-if="tagFilter" class="text-[11px] font-medium px-2 py-0.5 rounded-full" style="background: var(--accent-bg); color: var(--accent)">
            {{ tagFilter }}
          </span>
          <!-- View Toggle -->
          <div v-if="(store.currentGroupId || store.showAllGroups) && !searchKeyword.trim()" class="view-toggle">
            <button @click="setViewMode('card')" class="view-btn" :class="{ active: viewMode === 'card' }">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              卡片
            </button>
            <button @click="setViewMode('list')" class="view-btn" :class="{ active: viewMode === 'list' }">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              列表
            </button>
          </div>
        </div>
        <div class="flex gap-1">
          <button v-if="(store.currentGroupId || store.showAllGroups) && displayServices.length > 0" @click="toggleSelectMode" class="sub-header-btn" :style="{ borderColor: selectMode ? 'var(--accent)' : 'var(--border)', color: selectMode ? 'var(--accent)' : 'var(--text2)', background: selectMode ? 'var(--accent-bg)' : 'transparent' }">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            {{ selectMode ? '取消' : '选择' }}
          </button>
          <button v-if="!selectMode" @click="showExportModal = true" class="sub-header-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            导出
          </button>
          <label v-if="!selectMode" class="sub-header-btn cursor-pointer">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            导入
            <input type="file" accept=".json" style="display: none" @change="handleImport">
          </label>
        </div>
      </div>

      <!-- Service Content Area -->
      <div class="flex-1 p-5 overflow-y-auto" style="min-height: 0;">
        <div v-if="store.loading || isSearching" class="flex flex-col items-center justify-center py-20" style="color: var(--text3)">
          <div class="w-8 h-8 border-2 rounded-full animate-spin mb-3" style="border-color: var(--border2); border-top-color: var(--accent)"></div>
          <p class="text-sm">加载中...</p>
        </div>

        <div v-else-if="viewMode === 'card' && !searchKeyword.trim() && (store.currentGroupId || store.showAllGroups)" class="cards-grid">
          <template v-if="tagFilter || store.showAllGroups">
            <div v-for="(service, index) in displayServices" :key="service.id" class="card-wrapper" :style="{ animationDelay: `${index * 0.04}s` }">
              <ServiceCard :service="service" :selectable="selectMode" :selected="selectedServices.has(service.id)" @edit="handleEditService" @delete="handleDeleteService" @toggleSelect="toggleServiceSelection" />
            </div>
          </template>
          <template v-else>
            <draggable v-model="localServices" item-key="id" class="contents" ghost-class="opacity-40" animation="200" @end="handleDragEnd">
              <template #item="{ element: service, index }">
                <div class="card-wrapper" :style="{ animationDelay: `${index * 0.04}s` }">
                  <ServiceCard :service="service" :selectable="selectMode" :selected="selectedServices.has(service.id)" @edit="handleEditService" @delete="handleDeleteService" @toggleSelect="toggleServiceSelection" />
                </div>
              </template>
            </draggable>
            <button v-if="store.currentGroupId" @click="handleAddService" class="add-service-card">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>添加服务</span>
            </button>
          </template>
        </div>

        <div v-else-if="viewMode === 'list' && !searchKeyword.trim() && (store.currentGroupId || store.showAllGroups)" class="list-view-container">
          <ServiceListRow v-for="service in displayServices" :key="service.id" :service="service" :selectable="selectMode" :selected="selectedServices.has(service.id)" @edit="handleEditService" @delete="handleDeleteService" @toggleSelect="toggleServiceSelection" />
          <button v-if="store.currentGroupId" @click="handleAddService" class="add-service-list-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>添加服务</span>
          </button>
        </div>

        <div v-else-if="searchKeyword.trim()" class="cards-grid">
          <div v-if="displayServices.length === 0" class="col-span-full flex flex-col items-center justify-center py-16">
            <h3 class="text-[14px] font-semibold mb-1" style="color: var(--text2)">未找到匹配的服务</h3>
          </div>
          <template v-else>
            <div v-for="(service, index) in displayServices" :key="service.id" class="card-wrapper" :style="{ animationDelay: `${index * 0.04}s` }">
              <ServiceCard :service="service" :selectable="selectMode" :selected="selectedServices.has(service.id)" @edit="handleEditService" @delete="handleDeleteService" @toggleSelect="toggleServiceSelection" />
            </div>
          </template>
        </div>

        <div v-else class="flex flex-col items-center justify-center py-20 text-center">
          <h3 class="text-[14px] font-semibold mb-1" style="color: var(--text2)">请选择一个分组</h3>
          <p class="text-[13px]" style="color: var(--text3)">从左侧选择或创建一个分组开始</p>
        </div>
      </div>
      </template>

      <!-- ==================== Todos Page ==================== -->
      <template v-if="currentPage === 'todos'">
      <div class="flex-1 overflow-hidden flex flex-col" style="background: var(--bg)">
        <!-- Stats Bar -->
        <div class="todo-stats-bar">
          <div class="todo-stat-item"><span class="todo-stat-num" style="color: var(--amber);">{{ todoStats.todo }}</span> 待处理</div>
          <div class="todo-stat-item"><span class="todo-stat-num" style="color: var(--accent);">{{ todoStats.doing }}</span> 进行中</div>
          <div class="todo-stat-item"><span class="todo-stat-num" style="color: var(--green);">{{ todoStats.done }}</span> 已完成</div>
          <div class="todo-progress-mini"><div class="todo-progress-fill" :style="{ width: todoStats.progress + '%' }"></div></div>
          <span style="font-size: 11px; color: var(--text3);">{{ todoStats.progress }}%</span>
        </div>

        <!-- Toolbar -->
        <div class="todo-toolbar">
          <div class="flex gap-2">
            <button v-for="f in (['all', 'high', 'medium', 'low'] as const)" :key="f" @click="todoFilter = f" class="todo-filter-btn" :class="{ active: todoFilter === f }">
              {{ f === 'all' ? '全部' : f === 'high' ? '高优先' : f === 'medium' ? '中优先' : '低优先' }}
            </button>
          </div>
          <button @click="openTodoModal" class="todo-add-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建待办
          </button>
        </div>

        <!-- Kanban Board -->
        <div class="todo-kanban">
          <div v-for="col in [{ key: 'todo', label: '待处理', color: 'var(--amber)' }, { key: 'doing', label: '进行中', color: 'var(--accent)' }, { key: 'done', label: '已完成', color: 'var(--green)' }]" :key="col.key" class="todo-column">
            <div class="todo-column-header">
              <span class="todo-column-dot" :style="{ background: col.color }"></span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text);">{{ col.label }}</span>
              <span class="todo-column-count" :style="{ background: col.color + '15', color: col.color }">{{ getColumnList(col.key).length }}</span>
            </div>
            <div class="todo-column-body-wrap">
              <div v-if="getColumnList(col.key).length === 0" class="todo-empty">
                <span style="font-size: 20px; opacity: 0.3;">+</span>
                <span>拖入任务到此列</span>
              </div>
              <draggable
                class="todo-column-body"
                :list="getColumnList(col.key)"
                group="todos"
                item-key="id"
                :data-status="col.key"
                @end="(evt: any) => handleTodoDragEnd(evt, getColumnList(col.key))"
                ghost-class="todo-card-ghost"
                :animation="200"
              >
                <template #item="{ element: t, index: i }">
                  <div class="todo-card" :style="{ animationDelay: `${i * 0.04}s` }" @dblclick="openEditTodoModal(t)">
                    <div class="todo-card-bar" :style="{ background: getCardGradient(t.id) }"></div>
                    <div class="todo-card-title">{{ t.title }}</div>
                    <div v-if="t.desc" class="todo-card-desc">{{ t.desc }}</div>
                    <div class="todo-card-footer">
                      <div class="todo-card-meta">
                        <span v-if="t.tag" class="todo-card-tag" :style="{ background: getTagColor(t.tag) + '14', color: getTagColor(t.tag) }">{{ t.tag }}</span>
                        <span v-if="t.created_at" class="todo-card-time">{{ formatTodoTime(t.created_at) }}</span>
                      </div>
                      <div class="todo-card-actions">
                        <button v-if="col.key !== 'todo'" @click="handleMoveTodo(t.id, col.key === 'doing' ? 'todo' : 'doing')" class="todo-action-btn" title="前移">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <button v-if="col.key !== 'done'" @click="handleMoveTodo(t.id, col.key === 'todo' ? 'doing' : 'done')" class="todo-action-btn" title="后移">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"/></svg>
                        </button>
                        <button @click="handleDeleteTodo(t.id)" class="todo-action-btn delete" title="删除">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </template>
              </draggable>
            </div>
          </div>
        </div>
      </div>

      <!-- Todo Add Modal -->
      <div v-if="showTodoModal" class="fixed inset-0 flex items-center justify-center z-50 p-4" style="background: rgba(0,0,0,.36); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px)" @click.self="showTodoModal = false">
        <div class="w-full max-w-md rounded-3xl shadow-lg overflow-hidden" style="background: var(--surface); animation: modalIn 0.2s ease">
          <div class="px-6 py-5 border-b flex items-center justify-between" style="border-color: var(--border)">
            <span class="text-[15px] font-bold" style="color: var(--text)">{{ editingTodoId ? '编辑待办' : '新建待办' }}</span>
            <button @click="showTodoModal = false" class="w-7 h-7 rounded-md flex items-center justify-center" style="color: var(--text3)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="px-6 py-4 space-y-3">
            <div>
              <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">标题</label>
              <input v-model="todoForm.title" type="text" class="todo-form-input" :class="{ 'has-error': todoFormError }" placeholder="输入待办标题..." @keydown.enter="handleSaveTodo" />
              <p v-if="todoFormError" class="text-[11px] mt-1" style="color: var(--red)">{{ todoFormError }}</p>
            </div>
            <div>
              <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">描述</label>
              <textarea v-model="todoForm.desc" class="todo-form-input" style="resize: vertical; min-height: 52px;" placeholder="简要描述（可选）..." rows="2"></textarea>
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">优先级</label>
                <select v-model="todoForm.priority" class="todo-form-input">
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div class="flex-1" style="position: relative;">
                <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">标签</label>
                <input
                  v-model="customTagInput"
                  type="text"
                  class="todo-form-input"
                  placeholder="输入标签..."
                  @input="todoForm.tag = customTagInput; showTagSuggestions = true"
                  @focus="showTagSuggestions = tagSuggestions.length > 0"
                  @blur="hideTagSuggestions"
                />
                <div v-if="showTagSuggestions && tagSuggestions.length > 0" class="tag-suggestions">
                  <div v-for="s in tagSuggestions" :key="s" class="tag-suggestion-item" @mousedown.prevent="customTagInput = s; todoForm.tag = s; showTagSuggestions = false">{{ s }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="px-6 py-3.5 border-t flex justify-end gap-2" style="border-color: var(--border)">
            <button @click="showTodoModal = false" class="px-4 py-2 rounded-xl text-[13px] font-medium border" style="border-color: var(--border); color: var(--text2)">取消</button>
            <button @click="handleSaveTodo" class="px-4 py-2 rounded-xl text-[13px] font-medium" style="background: var(--accent); color: white">{{ editingTodoId ? '保存' : '创建' }}</button>
          </div>
        </div>
      </div>
      </template>

      <!-- ==================== Notes Page ==================== -->
      <template v-if="currentPage === 'notes'">
      <div class="flex-1 flex flex-col overflow-hidden" style="background: var(--bg)">
        <!-- Notes Toolbar -->
        <div class="notes-toolbar">
          <div class="notes-toolbar-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span style="font-size: 13px; font-weight: 600; color: var(--text);">日志笔记</span>
            <span v-if="noteUrl" style="font-size: 11px; color: var(--text3); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ noteUrl }}</span>
          </div>
          <div class="notes-toolbar-right">
            <button v-if="noteUrl" @click="noteUrlKey++" class="notes-toolbar-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              刷新
            </button>
            <button v-if="noteUrl" @click="clearNoteUrl" class="notes-toolbar-btn" style="color: var(--red);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              移除
            </button>
            <button @click="openNoteInput" class="notes-toolbar-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              {{ noteUrl ? '更换链接' : '嵌入链接' }}
            </button>
          </div>
        </div>

        <!-- Notes Content -->
        <div class="notes-content">
          <iframe
            v-if="noteUrl"
            :src="noteUrl"
            :key="noteUrlKey"
            class="notes-iframe"
          ></iframe>
          <div v-if="!noteUrl" class="notes-empty">
            <div class="notes-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div style="font-size: 16px; font-weight: 600; color: var(--text);">嵌入外部笔记</div>
            <div style="font-size: 13px; color: var(--text2); max-width: 360px; text-align: center; line-height: 1.7;">
              支持嵌入思源笔记、Notion、语雀等支持外部访问的笔记页面
            </div>
            <button @click="openNoteInput" class="notes-empty-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              嵌入链接
            </button>
          </div>
        </div>
      </div>

      <!-- Notes URL Input Modal -->
      <div v-if="showNoteInput" class="fixed inset-0 flex items-center justify-center z-50 p-4" style="background: rgba(0,0,0,.36); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px)" @click.self="showNoteInput = false">
        <div class="w-full max-w-lg rounded-3xl shadow-lg overflow-hidden" style="background: var(--surface); animation: modalIn 0.2s ease">
          <div class="px-6 py-5 border-b flex items-center justify-between" style="border-color: var(--border)">
            <span class="text-[15px] font-bold" style="color: var(--text)">嵌入笔记链接</span>
            <button @click="showNoteInput = false" class="w-7 h-7 rounded-md flex items-center justify-center" style="color: var(--text3)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="px-6 py-4">
            <label class="block text-xs font-semibold mb-2" style="color: var(--text2)">笔记页面地址</label>
            <input v-model="noteUrlInput" type="url" class="todo-form-input" placeholder="例如: http://localhost:6806/stage/build/desktop/?r=xxx" @keydown.enter="saveNoteUrl" />
            <p style="font-size: 11px; color: var(--text3); margin-top: 8px; line-height: 1.6;">
              提示：输入目标笔记的完整地址，如 <code style="background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 10px;">http://192.168.1.100:6806</code>
            </p>
          </div>
          <div class="px-6 py-3.5 border-t flex justify-end gap-2" style="border-color: var(--border)">
            <button @click="showNoteInput = false" class="px-4 py-2 rounded-xl text-[13px] font-medium border" style="border-color: var(--border); color: var(--text2)">取消</button>
            <button @click="saveNoteUrl" class="px-4 py-2 rounded-xl text-[13px] font-medium" style="background: var(--purple); color: white">确认嵌入</button>
          </div>
        </div>
      </div>
      </template>
    </main>

    <!-- Modals (always available) -->
    <ServiceModal
      :show="showServiceModal"
      :service="editingService"
      :current-group-id="store.currentGroupId"
      @close="showServiceModal = false"
      @saved="() => {}"
    />

    <GroupModal
      :show="showGroupModal"
      :group="editingGroup"
      @close="showGroupModal = false"
      @saved="store.fetchGroups"
    />

    <ExportModal
      :show="showExportModal"
      @close="showExportModal = false"
    />
  </div>
</template>

<style scoped>
/* ========== Top Tab Bar ========== */
.topbar {
  height: 46px;
  min-height: 46px;
  background: #ffffff;
  border-bottom: 1px solid #e5e5e5;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 0;
  flex-shrink: 0;
}

[data-theme="dark"] .topbar {
  background: #0a0a0a;
  border-bottom-color: #1a1a1a;
}

.topbar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 20px;
  flex-shrink: 0;
}

.topbar-logo-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-logo-text {
  font-size: 14px;
  font-weight: 500;
  font-family: 'SF Pro Rounded', system-ui, -apple-system, sans-serif;
  color: #000000;
  letter-spacing: -0.3px;
}

[data-theme="dark"] .topbar-logo-text {
  color: #ffffff;
}

.topbar-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
}

.topbar-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 9999px;
  cursor: pointer;
  border: none;
  background: transparent;
  color: #737373;
  font-size: 13px;
  font-weight: 400;
  font-family: system-ui, -apple-system, sans-serif;
}

.topbar-tab:hover {
  background: #fafafa;
  color: #262626;
}

[data-theme="dark"] .topbar-tab {
  color: #a3a3a3;
}

[data-theme="dark"] .topbar-tab:hover {
  background: #111111;
  color: #d4d4d4;
}

.topbar-tab.active {
  background: #e5e5e5;
  color: #000000;
  font-weight: 500;
}

[data-theme="dark"] .topbar-tab.active {
  background: #262626;
  color: #ffffff;
}

.tab-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 9999px;
  font-weight: 400;
  line-height: 1.4;
  background: #fafafa;
  color: #737373;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.topbar-tab.active .tab-badge {
  background: #d4d4d4;
  color: #262626;
}

[data-theme="dark"] .tab-badge {
  background: #1a1a1a;
  color: #a3a3a3;
}

[data-theme="dark"] .topbar-tab.active .tab-badge {
  background: #333333;
  color: #d4d4d4;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.topbar-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: #a3a3a3;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-icon-btn:hover {
  background: #fafafa;
  color: #262626;
}

[data-theme="dark"] .topbar-icon-btn {
  color: #525252;
}

[data-theme="dark"] .topbar-icon-btn:hover {
  background: #111111;
  color: #d4d4d4;
}

.topbar-icon-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--text);
}

[data-theme="dark"] .topbar-icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

/* ========== Service Sub-Header ========== */
.sub-header-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  transition: all 0.2s;
}

.sub-header-btn:hover {
  border-color: var(--border2);
  color: var(--text);
}

/* ========== Cards Grid ========== */
.card-wrapper {
  display: flex;
  min-width: 0;
}

.card-wrapper > :deep(*) {
  flex: 1;
  min-width: 0;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.add-service-card {
  border: 2px dashed var(--border2);
  border-radius: 16px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  background: transparent;
  color: var(--text3);
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.add-service-card:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.add-service-card span {
  font-size: 13px;
  font-weight: 500;
}

.view-toggle {
  display: flex;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 2px;
}

[data-theme="dark"] .view-toggle {
  background: rgba(255, 255, 255, 0.06);
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  background: transparent;
  color: var(--text3);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 6px;
}

.view-btn:hover { color: var(--text); }

.view-btn.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.list-view-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-service-list-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: 2px dashed var(--border2);
  border-radius: 14px;
  background: transparent;
  color: var(--text3);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.add-service-list-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

/* ========== Todos Page ========== */
.todo-stats-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 24px;
}

.todo-stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text2);
}

.todo-stat-num {
  font-weight: 700;
  font-size: 15px;
}

.todo-progress-mini {
  width: 100px;
  height: 3px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

[data-theme="dark"] .todo-progress-mini {
  background: rgba(255, 255, 255, 0.08);
}

.todo-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--amber), var(--green));
  transition: width 0.4s ease;
}

.todo-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 24px 12px;
}

.todo-filter-btn {
  padding: 5px 14px;
  border-radius: 18px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  transition: all 0.2s;
}

.todo-filter-btn:hover {
  border-color: var(--border2);
  color: var(--text);
}

.todo-filter-btn.active {
  background: rgba(255, 149, 0, 0.1);
  border-color: rgba(255, 149, 0, 0.3);
  color: var(--amber);
}

.todo-add-btn {
  margin-left: auto;
  padding: 6px 16px;
  border-radius: 18px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: var(--accent);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 5px;
}

.todo-add-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 122, 255, 0.25);
}

.todo-kanban {
  display: flex;
  gap: 14px;
  padding: 0 24px 24px;
  flex: 1;
  overflow: hidden;
}

.todo-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}

[data-theme="dark"] .todo-column {
  background: rgba(255, 255, 255, 0.02);
}

.todo-column-header {
  padding: 11px 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid var(--border);
}

.todo-column-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.todo-column-count {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 9px;
  font-weight: 700;
  margin-left: auto;
}

.todo-column-body-wrap {
  flex: 1;
  position: relative;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 60px;
}

.todo-column-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 8px;
  min-height: 100%;
}

.todo-card-ghost {
  opacity: 0.4;
  background: var(--accent) !important;
  border-color: var(--accent) !important;
}

.todo-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text3);
  font-size: 12px;
  pointer-events: none;
  opacity: 0.6;
}

.todo-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  animation: cardIn 0.22s ease backwards;
  overflow: hidden;
}

.todo-card:hover {
  border-color: var(--border2);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.todo-card-bar {
  height: 3px;
  width: 100%;
  flex-shrink: 0;
}

.todo-card-title {
  font-size: 13px;
  font-weight: 500;
  padding: 10px 12px 0 12px;
  line-height: 1.4;
  color: var(--text);
  text-align: center;
}

.todo-card-desc {
  font-size: 11px;
  color: var(--text3);
  line-height: 1.5;
  padding: 3px 12px 0 12px;
}

.todo-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 10px 12px;
}

.todo-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.todo-card-tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 5px;
  font-weight: 500;
  flex-shrink: 0;
}

.todo-card-time {
  font-size: 10px;
  color: var(--text3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.todo-card-actions {
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.15s;
}

.todo-card:hover .todo-card-actions {
  opacity: 1;
}

.todo-action-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.todo-action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.todo-action-btn.delete:hover {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-bg);
}

.todo-form-input {
  width: 100%;
  padding: 8px 11px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  outline: none;
  transition: border-color 0.2s;
}

.todo-form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.todo-form-input.has-error {
  border-color: var(--red);
}

/* Tag Suggestions */
.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 100;
  overflow: hidden;
}
.tag-suggestion-item {
  padding: 7px 12px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s;
}
.tag-suggestion-item:hover {
  background: var(--accent);
  color: white;
}

/* ========== Notes Page ========== */
.notes-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}
.notes-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.notes-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.notes-toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  transition: all 0.15s;
}
.notes-toolbar-btn:hover {
  background: var(--surface);
}
.notes-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.notes-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
.notes-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.notes-empty-icon {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: rgba(175, 82, 222, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.notes-empty-btn {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 18px;
  border-radius: 12px;
  border: none;
  background: var(--purple);
  color: white;
  cursor: pointer;
  transition: all 0.15s;
}
.notes-empty-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}
</style>