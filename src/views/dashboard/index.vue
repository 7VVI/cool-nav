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

const navStore = useNavStore();

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

// Computed: current group name
const currentGroupName = computed(() => {
  return navStore.currentGroup?.name || 'All Services';
});

// Computed: service count
const serviceCount = computed(() => {
  return displayServices.value.length;
});

// Watch current services to sync with local
watch(
  () => navStore.currentServices,
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

// Handle export button
function handleExport() {
  showExportModal.value = true;
}

// Handle drag end - update sort order
async function handleDragEnd() {
  if (searchKeyword.value.trim()) {
    // Don't reorder when searching
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
    // Revert to original order
    localServices.value = [...navStore.currentServices];
  }
}

// Handle service modal close
function handleServiceModalClose() {
  showServiceModal.value = false;
  editingService.value = null;
}

// Handle service modal save
function handleServiceModalSaved() {
  navStore.fetchServices();
}

// Handle group modal close
function handleGroupModalClose() {
  showGroupModal.value = false;
  editingGroup.value = null;
}

// Handle group modal save
function handleGroupModalSaved() {
  navStore.fetchGroups();
}

// Initialize data on mount
onMounted(() => {
  navStore.fetchGroups();
});
</script>

<template>
  <div class="dashboard">
    <!-- Sidebar -->
    <Sidebar
      @edit-group="handleEditGroup"
      @search-services="handleSearchServices"
    />

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div class="header-left">
          <h1 class="page-title">
            {{ searchKeyword.trim() ? 'Search Results' : currentGroupName }}
          </h1>
          <span class="service-count">{{ serviceCount }} services</span>
        </div>
        <div class="header-actions">
          <button
            class="btn btn-primary"
            @click="handleAddService"
            :disabled="!navStore.currentGroupId && !searchKeyword.trim()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Service
          </button>
          <button class="btn btn-secondary" @click="handleExport">
            <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
          </button>
        </div>
      </header>

      <!-- Content Area -->
      <div class="content-body">
        <!-- Loading State -->
        <div v-if="navStore.loading || isSearching" class="loading-state">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="displayServices.length === 0"
          class="empty-state"
        >
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          </div>
          <h3 class="empty-title">No services found</h3>
          <p class="empty-description">
            {{ searchKeyword.trim() ? 'Try a different search term' : 'Add your first service to get started' }}
          </p>
          <button
            v-if="!searchKeyword.trim() && navStore.currentGroupId"
            class="btn btn-primary"
            @click="handleAddService"
          >
            Add Service
          </button>
        </div>

        <!-- Service Grid -->
        <draggable
          v-else
          v-model="localServices"
          item-key="id"
          class="service-grid"
          ghost-class="ghost-card"
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
      @close="handleServiceModalClose"
      @saved="handleServiceModalSaved"
    />

    <GroupModal
      :show="showGroupModal"
      :group="editingGroup"
      @close="handleGroupModalClose"
      @saved="handleGroupModalSaved"
    />

    <ExportModal
      :show="showExportModal"
      @close="showExportModal = false"
    />
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  min-height: 100vh;
  background: #11111b;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #1e1e2e;
  border-bottom: 1px solid #313244;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #cdd6f4;
  margin: 0;
}

.service-count {
  font-size: 14px;
  color: #6c7086;
  background: #313244;
  padding: 4px 10px;
  border-radius: 12px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.btn-primary {
  background: #89b4fa;
  color: #1e1e2e;
}

.btn-primary:hover:not(:disabled) {
  background: #b4befe;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #313244;
  color: #cdd6f4;
}

.btn-secondary:hover {
  background: #45475a;
}

.content-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.ghost-card {
  opacity: 0.5;
  background: #89b4fa;
  border-radius: 8px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #6c7086;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #313244;
  border-top-color: #89b4fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  color: #45475a;
  margin-bottom: 24px;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #cdd6f4;
  margin: 0 0 8px;
}

.empty-description {
  font-size: 14px;
  color: #6c7086;
  margin: 0 0 24px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .content-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    flex: 1;
    justify-content: center;
  }

  .service-grid {
    grid-template-columns: 1fr;
  }
}
</style>