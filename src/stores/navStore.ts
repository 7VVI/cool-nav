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
  const showAllGroups = ref(false); // 显示所有分组的服务
  const loading = ref(false);

  const currentGroup = computed(() => groups.value.find(g => g.id === currentGroupId.value));

  const currentServices = computed(() => {
    if (showAllGroups.value) {
      // 显示所有分组的服务
      return services.value;
    }
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

      if (!showAllGroups.value && (!currentGroupId.value || !currentGroupExists)) {
        // 没有选中分组或当前分组已被删除，选择第一个分组
        if (groups.value.length > 0) {
          currentGroupId.value = groups.value[0].id;
          await fetchServices();
        } else {
          currentGroupId.value = null;
          services.value = [];
        }
      } else if (showAllGroups.value) {
        // 显示全部时，获取所有服务
        await fetchAllServices();
      }
    } finally {
      loading.value = false;
    }
  }

  // 获取所有服务
  async function fetchAllServices() {
    const res = await servicesApi.getAll();
    services.value = res.data;
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
    // 创建新数组，触发响应式更新
    services.value = [...services.value, res.data];
    await fetchGroups();
    return res.data;
  }

  async function updateService(id: number, data: Partial<Service>) {
    const res = await servicesApi.update(id, data);
    // 使用 map 创建新数组，触发响应式更新
    services.value = services.value.map(s => s.id === id ? res.data : s);
    await fetchGroups();
  }

  async function deleteService(id: number) {
    await servicesApi.delete(id);
    services.value = services.value.filter(s => s.id !== id);
    await fetchGroups();
  }

  function selectGroup(id: number) {
    showAllGroups.value = false;
    currentGroupId.value = id;
    fetchServices();
  }

  function selectAllGroups() {
    showAllGroups.value = true;
    currentGroupId.value = null;
    fetchAllServices();
  }

  return {
    groups,
    services,
    currentGroupId,
    showAllGroups,
    currentGroup,
    currentServices,
    loading,
    fetchGroups,
    fetchServices,
    fetchAllServices,
    refreshCurrentGroup,
    addGroup,
    updateGroup,
    deleteGroup,
    addService,
    updateService,
    deleteService,
    selectGroup,
    selectAllGroups
  };
});