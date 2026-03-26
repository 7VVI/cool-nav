// src/stores/navStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { groupsApi } from '@/api/groups';
import { servicesApi } from '@/api/services';
import type { Group, Service } from '@/types';

export const useNavStore = defineStore('nav', () => {
  const groups = ref<Group[]>([]);
  const services = ref<Service[]>([]);
  const currentGroupId = ref<number | null>(null);
  const loading = ref(false);

  const currentGroup = computed(() => groups.value.find(g => g.id === currentGroupId.value));

  const currentServices = computed(() => {
    if (!currentGroupId.value) return [];
    return services.value.filter(s => s.group_id === currentGroupId.value);
  });

  async function fetchGroups() {
    loading.value = true;
    try {
      const res = await groupsApi.getAll();
      groups.value = res.data;

      // 检查当前分组是否还有效
      const currentGroupExists = groups.value.some(g => g.id === currentGroupId.value);

      if (!currentGroupId.value || !currentGroupExists) {
        // 没有选中分组或当前分组已被删除，选择第一个分组
        if (groups.value.length > 0) {
          currentGroupId.value = groups.value[0].id;
          await fetchServices();
        } else {
          currentGroupId.value = null;
          services.value = [];
        }
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchServices(groupId?: number) {
    const id = groupId || currentGroupId.value;
    if (!id) return;
    const res = await servicesApi.getAll(id);
    services.value = res.data;
  }

  // 刷新当前分组的服务（保持当前分组不变）
  async function refreshCurrentGroup() {
    if (currentGroupId.value) {
      await fetchServices();
    }
  }

  async function addGroup(data: Partial<Group>) {
    const res = await groupsApi.create(data);
    groups.value.push(res.data);
    return res.data;
  }

  async function updateGroup(id: number, data: Partial<Group>) {
    const res = await groupsApi.update(id, data);
    const index = groups.value.findIndex(g => g.id === id);
    if (index > -1) {
      groups.value[index] = { ...groups.value[index], ...res.data };
    }
  }

  async function deleteGroup(id: number) {
    await groupsApi.delete(id);
    groups.value = groups.value.filter(g => g.id !== id);
    if (currentGroupId.value === id) {
      currentGroupId.value = groups.value[0]?.id || null;
    }
  }

  async function addService(data: Partial<Service>) {
    const res = await servicesApi.create(data);
    services.value.push(res.data);
    await fetchGroups(); // Update service count
    return res.data;
  }

  async function updateService(id: number, data: Partial<Service>) {
    const res = await servicesApi.update(id, data);
    const index = services.value.findIndex(s => s.id === id);
    if (index > -1) {
      services.value[index] = res.data;
    }
    await fetchGroups();
  }

  async function deleteService(id: number) {
    await servicesApi.delete(id);
    services.value = services.value.filter(s => s.id !== id);
    await fetchGroups();
  }

  function selectGroup(id: number) {
    currentGroupId.value = id;
    fetchServices();
  }

  return {
    groups,
    services,
    currentGroupId,
    currentGroup,
    currentServices,
    loading,
    fetchGroups,
    fetchServices,
    refreshCurrentGroup,
    addGroup,
    updateGroup,
    deleteGroup,
    addService,
    updateService,
    deleteService,
    selectGroup
  };
});