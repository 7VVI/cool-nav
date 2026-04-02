<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import draggable from 'vuedraggable';
import { useNavStore } from '@/stores/navStore';
import { useAuthStore } from '@/stores/authStore';
import { servicesApi } from '@/api/services';
import { groupsApi } from '@/api/groups';
import Sidebar from '@/components/Sidebar.vue';
import ServiceCard from '@/components/ServiceCard.vue';
import ServiceListRow from '@/components/ServiceListRow.vue';
import ServiceModal from '@/components/ServiceModal.vue';
import GroupModal from '@/components/GroupModal.vue';
import ExportModal from '@/components/ExportModal.vue';
import type { Group, Service } from '@/types';

const store = useNavStore();
const authStore = useAuthStore();

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
  (newServices) => {
    if (!searchKeyword.value.trim()) {
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
});

// Handle import
function handleImport(file: File) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.groups && data.services) {
        // Call import API
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
</script>

<template>
  <div class="flex h-screen" style="background: var(--bg)">
    <!-- Sidebar -->
    <Sidebar
      @editGroup="handleEditGroup"
      @searchServices="handleSearchServices"
      @deleteGroup="handleDeleteGroup"
      @showExport="showExportModal = true"
      @importData="handleImport"
      @filterByTag="handleFilterByTag"
    />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header
        class="flex items-center justify-between px-6 border-b flex-shrink-0"
        style="height: 52px; background: var(--surface); border-color: var(--border)"
      >
        <div class="flex items-center gap-3">
          <h1 class="text-[15px] font-bold" style="color: var(--text); letter-spacing: -0.2px">
            {{ searchKeyword.trim() ? `搜索: ${searchKeyword}` : (tagFilter ? `标签筛选` : (store.currentGroup?.name || '全部服务')) }}
          </h1>
          <span class="text-xs font-medium px-2.5 py-0.5 rounded-full" style="background: var(--surface2); color: var(--text3)">
            {{ displayServices.length }} 个服务
          </span>
          <span v-if="selectMode && selectedServices.size > 0" class="text-xs font-medium px-2.5 py-0.5 rounded-full" style="background: var(--accent); color: white">
            已选 {{ selectedServices.size }} 项
          </span>
          <span v-if="tagFilter" class="text-xs font-medium px-2.5 py-0.5 rounded-full" style="background: var(--accent-bg); color: var(--accent)">
            {{ tagFilter }}
          </span>
          <!-- View Toggle -->
          <div v-if="store.currentGroupId && !searchKeyword.trim()" class="view-toggle">
            <button
              @click="setViewMode('card')"
              class="view-btn"
              :class="{ active: viewMode === 'card' }"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              卡片
            </button>
            <button
              @click="setViewMode('list')"
              class="view-btn"
              :class="{ active: viewMode === 'list' }"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              列表
            </button>
          </div>
        </div>
        <div class="flex gap-1.5">
          <!-- Selection Mode Toggle -->
          <button
            v-if="store.currentGroupId && displayServices.length > 0"
            @click="toggleSelectMode"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            :style="{
              borderColor: selectMode ? 'var(--accent)' : 'var(--border)',
              color: selectMode ? 'var(--accent)' : 'var(--text2)',
              background: selectMode ? 'var(--accent-bg)' : 'transparent'
            }"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
            <span>{{ selectMode ? '取消选择' : '选择' }}</span>
          </button>
          <!-- Export Selected -->
          <button
            v-if="selectMode"
            @click="exportSelectedServices"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            :style="{
              background: selectedServices.size > 0 ? 'var(--accent)' : 'var(--surface2)',
              color: selectedServices.size > 0 ? 'white' : 'var(--text3)'
            }"
            :disabled="selectedServices.size === 0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>导出选中</span>
          </button>
          <!-- Select All / Clear -->
          <button
            v-if="selectMode"
            @click="selectedServices.size === displayServices.length ? clearSelection() : selectAllServices()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style="border-color: var(--border); color: var(--text2)"
          >
            {{ selectedServices.size === displayServices.length ? '取消全选' : '全选' }}
          </button>
          <button
            v-if="!selectMode"
            @click="showExportModal = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style="border-color: var(--border); color: var(--text2)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>导出</span>
          </button>
        </div>
      </header>

      <!-- Content Area -->
      <div class="flex-1 p-6 overflow-y-auto">
        <!-- Loading State -->
        <div v-if="store.loading || isSearching" class="flex flex-col items-center justify-center py-20" style="color: var(--text3)">
          <div class="w-8 h-8 border-2 rounded-full animate-spin mb-3" style="border-color: var(--border2); border-top-color: var(--accent)"></div>
          <p>加载中...</p>
        </div>

        <!-- Card View: Service Grid with Add Button -->
        <div
          v-else-if="viewMode === 'card' && !searchKeyword.trim() && store.currentGroupId"
          class="grid gap-3.5"
          style="grid-template-columns: repeat(auto-fill, minmax(240px, 240px)); align-items: stretch"
        >
          <!-- Tag filter mode: show filtered services without draggable -->
          <template v-if="tagFilter">
            <div v-for="(service, index) in displayServices" :key="service.id" class="card-wrapper" :style="{ animationDelay: `${index * 0.04}s` }">
              <ServiceCard
                :service="service"
                :selectable="selectMode"
                :selected="selectedServices.has(service.id)"
                @edit="handleEditService"
                @delete="handleDeleteService"
                @toggleSelect="toggleServiceSelection"
              />
            </div>
          </template>
          <!-- Normal mode: draggable list -->
          <template v-else>
            <draggable
              v-model="localServices"
              item-key="id"
              class="contents"
              ghost-class="opacity-40"
              animation="200"
              @end="handleDragEnd"
            >
              <template #item="{ element: service, index }">
                <div class="card-wrapper" :style="{ animationDelay: `${index * 0.04}s` }">
                  <ServiceCard
                    :service="service"
                    :selectable="selectMode"
                    :selected="selectedServices.has(service.id)"
                    @edit="handleEditService"
                    @delete="handleDeleteService"
                    @toggleSelect="toggleServiceSelection"
                  />
                </div>
              </template>
            </draggable>

            <!-- Add Service Card - 在网格内显示 -->
            <button
              @click="handleAddService"
              class="add-service-card"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>添加服务</span>
            </button>
          </template>
        </div>

        <!-- List View -->
        <div v-else-if="viewMode === 'list' && !searchKeyword.trim() && store.currentGroupId" class="list-view-container">
          <template v-if="displayServices.length > 0">
            <ServiceListRow
              v-for="service in displayServices"
              :key="service.id"
              :service="service"
              :selectable="selectMode"
              :selected="selectedServices.has(service.id)"
              @edit="handleEditService"
              @delete="handleDeleteService"
              @toggleSelect="toggleServiceSelection"
            />
          </template>

          <div v-else class="flex flex-col items-center justify-center py-16">
            <div class="text-4xl mb-3">🔍</div>
            <h3 class="text-[15px] font-semibold mb-1" style="color: var(--text2)">暂无服务</h3>
          </div>

          <!-- Add Service Button for List View -->
          <button
            @click="handleAddService"
            class="add-service-list-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>添加服务</span>
          </button>
        </div>

        <!-- Search Results -->
        <div
          v-else-if="searchKeyword.trim()"
          class="grid gap-3.5"
          style="grid-template-columns: repeat(auto-fill, minmax(240px, 240px)); align-items: stretch"
        >
          <div v-if="displayServices.length === 0" class="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div class="text-[40px] mb-3">🔍</div>
            <h3 class="text-[15px] font-semibold mb-1" style="color: var(--text2)">未找到匹配的服务</h3>
          </div>
          <template v-else>
            <div v-for="(service, index) in displayServices" :key="service.id" class="card-wrapper" :style="{ animationDelay: `${index * 0.04}s` }">
              <ServiceCard
                :service="service"
                :selectable="selectMode"
                :selected="selectedServices.has(service.id)"
                @edit="handleEditService"
                @delete="handleDeleteService"
                @toggleSelect="toggleServiceSelection"
              />
            </div>
          </template>
        </div>

        <!-- No Group Selected -->
        <div v-else class="flex flex-col items-center justify-center py-20 text-center">
          <div class="text-[40px] mb-3">👈</div>
          <h3 class="text-[15px] font-semibold mb-1" style="color: var(--text2)">请选择一个分组</h3>
          <p class="text-[13px]" style="color: var(--text3)">从左侧选择或创建一个分组开始</p>
        </div>
      </div>
    </main>

    <!-- Modals -->
    <ServiceModal
      :show="showServiceModal"
      :service="editingService"
      :current-group-id="store.currentGroupId"
      @close="showServiceModal = false"
      @saved="store.fetchServices()"
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
.card-wrapper {
  display: flex;
  min-width: 0;
}

.card-wrapper > :deep(*) {
  flex: 1;
  min-width: 0;
}

.add-service-card {
  border: 2px dashed var(--border2);
  border-radius: 16px;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  background: transparent;
  color: var(--text3);
  transition: all 0.18s;
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.view-btn:hover {
  background: var(--surface2);
}

.view-btn.active {
  background: var(--surface2);
  color: var(--text);
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
  border-radius: 12px;
  background: transparent;
  color: var(--text3);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
}

.add-service-list-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}
</style>