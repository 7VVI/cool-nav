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
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Sidebar -->
    <Sidebar
      @editGroup="handleEditGroup"
      @searchServices="handleSearchServices"
      @deleteGroup="handleDeleteGroup"
    />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-semibold text-gray-800">
            {{ searchKeyword.trim() ? `搜索: ${searchKeyword}` : (store.currentGroup?.name || '请选择分组') }}
          </h1>
          <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {{ displayServices.length }} 个服务
          </span>
        </div>
        <div class="flex gap-3">
          <button
            v-if="store.currentGroupId && !searchKeyword"
            @click="handleAddService"
            class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>添加服务</span>
          </button>
          <button
            @click="showExportModal = true"
            class="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <span>📤</span>
            <span>导出</span>
          </button>
        </div>
      </header>

      <!-- Content Area -->
      <div class="flex-1 p-6 overflow-y-auto">
        <!-- Loading State -->
        <div v-if="store.loading || isSearching" class="flex flex-col items-center justify-center py-20 text-gray-400">
          <div class="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-3"></div>
          <p>加载中...</p>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="displayServices.length === 0"
          class="flex flex-col items-center justify-center py-20 text-center"
        >
          <div class="text-6xl mb-4">📭</div>
          <h3 class="text-lg font-medium text-gray-700 mb-2">暂无服务</h3>
          <p class="text-gray-500 mb-4">
            {{ searchKeyword.trim() ? '未找到匹配的服务' : '点击"添加服务"开始' }}
          </p>
          <button
            v-if="!searchKeyword.trim() && store.currentGroupId"
            @click="handleAddService"
            class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            添加服务
          </button>
        </div>

        <!-- Service Grid -->
        <draggable
          v-else
          v-model="localServices"
          item-key="id"
          class="grid gap-4"
          style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));"
          ghost-class="opacity-50"
          animation="200"
          :disabled="!!searchKeyword.trim()"
          @end="handleDragEnd"
        >
          <template #item="{ element: service }">
            <ServiceCard
              :service="service"
              @edit="handleEditService"
            />
          </template>
        </draggable>
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