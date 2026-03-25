<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import draggable from 'vuedraggable';
import { useNavStore } from '@/stores/navStore';
import { servicesApi } from '@/api/services';
import Sidebar from '@/components/Sidebar.vue';
import ServiceCard from '@/components/ServiceCard.vue';
import ServiceModal from '@/components/ServiceModal.vue';
import GroupModal from '@/components/GroupModal.vue';
import ExportModal from '@/components/ExportModal.vue';
import type { Group, Service } from '@/types';

const store = useNavStore();

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

// Selection mode
const selectMode = ref(false);
const selectedServices = ref<Set<number>>(new Set());

// Local draggable list for services
const localServices = ref<Service[]>([]);

// Computed: display services (search results or current group services)
const displayServices = computed(() => {
  if (searchKeyword.value.trim()) {
    return searchResults.value;
  }
  return localServices.value;
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
  () => {
    selectedServices.value.clear();
    selectMode.value = false;
  }
);

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
      headers: { 'Content-Type': 'application/json' },
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
  if (confirm(`确定删除「${service.name}」吗？此操作不可撤销。`)) {
    try {
      await store.deleteService(service.id);
    } catch (error) {
      console.error('Failed to delete service:', error);
    }
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
          headers: { 'Content-Type': 'application/json' },
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
            {{ searchKeyword.trim() ? `搜索: ${searchKeyword}` : (store.currentGroup?.name || '全部服务') }}
          </h1>
          <span class="text-xs font-medium px-2.5 py-0.5 rounded-full" style="background: var(--surface2); color: var(--text3)">
            {{ displayServices.length }} 个服务
          </span>
          <span v-if="selectMode && selectedServices.size > 0" class="text-xs font-medium px-2.5 py-0.5 rounded-full" style="background: var(--accent); color: white">
            已选 {{ selectedServices.size }} 项
          </span>
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

        <!-- Service Grid with Add Button -->
        <div
          v-else-if="!searchKeyword.trim() && store.currentGroupId"
          class="grid gap-3.5"
          style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))"
        >
          <draggable
            v-model="localServices"
            item-key="id"
            class="contents"
            ghost-class="opacity-40"
            animation="200"
            @end="handleDragEnd"
          >
            <template #item="{ element: service, index }">
              <div :style="{ animationDelay: `${index * 0.04}s` }">
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
        </div>

        <!-- Search Results -->
        <div
          v-else-if="searchKeyword.trim()"
          class="grid gap-3.5"
          style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))"
        >
          <div v-if="displayServices.length === 0" class="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div class="text-[40px] mb-3">🔍</div>
            <h3 class="text-[15px] font-semibold mb-1" style="color: var(--text2)">未找到匹配的服务</h3>
          </div>
          <template v-else>
            <div v-for="(service, index) in displayServices" :key="service.id" :style="{ animationDelay: `${index * 0.04}s` }">
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
</style>