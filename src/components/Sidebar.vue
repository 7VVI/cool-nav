<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import draggable from 'vuedraggable';
import { groupsApi } from '@/api/groups';
import { useNavStore } from '@/stores/navStore';
import type { Group } from '@/types';

const emit = defineEmits<{
  editGroup: [group: Group | null];
  searchServices: [keyword: string];
  deleteGroup: [group: Group];
}>();

const store = useNavStore();
const searchKeyword = ref('');
const localGroups = ref<Group[]>([]);
const expandedGroups = ref<Set<number>>(new Set());

// 同步分组数据
watch(() => store.groups, (newGroups) => {
  localGroups.value = [...newGroups];
}, { immediate: true, deep: true });

// 获取根分组
const rootGroups = computed(() => {
  return localGroups.value.filter(g => !g.parent_id).sort((a, b) => a.sort_order - b.sort_order);
});

// 获取子分组
function getChildGroups(parentId: number) {
  return localGroups.value.filter(g => g.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
}

// 切换展开状态
function toggleExpand(id: number) {
  if (expandedGroups.value.has(id)) {
    expandedGroups.value.delete(id);
  } else {
    expandedGroups.value.add(id);
  }
}

function isExpanded(id: number) {
  return expandedGroups.value.has(id);
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

// 搜索
watch(searchKeyword, (keyword) => {
  emit('searchServices', keyword);
});

// 删除分组（二次确认）
function handleDeleteGroup(group: Group) {
  if (confirm(`确定删除分组「${group.name}」？分组下的所有服务也会被删除。`)) {
    emit('deleteGroup', group);
  }
}
</script>

<template>
  <aside class="w-[240px] bg-white border-r border-gray-200 flex flex-col h-screen flex-shrink-0">
    <!-- 搜索框 -->
    <div class="p-4 border-b border-gray-200">
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="搜索分组或服务..."
        class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <!-- 分组列表 -->
    <div class="flex-1 overflow-y-auto p-2">
      <div class="text-xs text-gray-400 font-medium px-3 py-2 uppercase tracking-wider">分组</div>

      <draggable
        v-model="localGroups"
        item-key="id"
        @end="onDragEnd"
        class="space-y-1"
      >
        <template #item="{ element: group }">
          <!-- 只渲染根分组 -->
          <div v-if="!group.parent_id" :key="group.id">
            <!-- 根分组项 -->
            <div
              :class="[
                'px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-colors',
                store.currentGroupId === group.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              ]"
              @click="store.selectGroup(group.id)"
            >
              <!-- 展开/折叠按钮 -->
              <button
                v-if="getChildGroups(group.id).length > 0"
                @click.stop="toggleExpand(group.id)"
                class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <span class="text-xs">{{ isExpanded(group.id) ? '▼' : '▶' }}</span>
              </button>
              <span v-else class="w-4"></span>

              <!-- 文件夹图标 -->
              <span class="text-base">📁</span>

              <!-- 分组名称 -->
              <span class="flex-1 text-sm font-medium truncate">{{ group.name }}</span>

              <!-- 服务数量 -->
              <span
                v-if="group.serviceCount"
                :class="[
                  'text-xs px-1.5 py-0.5 rounded-full',
                  store.currentGroupId === group.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-500'
                ]"
              >
                {{ group.serviceCount }}
              </span>

              <!-- 编辑按钮 -->
              <button
                @click.stop="emit('editGroup', group)"
                class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 transition-opacity p-1"
              >
                ✏️
              </button>
              <!-- 删除按钮 -->
              <button
                @click.stop="handleDeleteGroup(group)"
                class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
              >
                🗑️
              </button>
            </div>

            <!-- 子分组列表 -->
            <div
              v-if="isExpanded(group.id) && getChildGroups(group.id).length > 0"
              class="ml-6 mt-1 space-y-1 border-l-2 border-gray-100 pl-2"
            >
              <div
                v-for="child in getChildGroups(group.id)"
                :key="child.id"
                :class="[
                  'px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-colors',
                  store.currentGroupId === child.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                ]"
                @click="store.selectGroup(child.id)"
              >
                <span class="text-sm">📁</span>
                <span class="flex-1 text-sm truncate">{{ child.name }}</span>
                <span
                  v-if="child.serviceCount"
                  :class="[
                    'text-xs px-1.5 py-0.5 rounded-full',
                    store.currentGroupId === child.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-500'
                  ]"
                >
                  {{ child.serviceCount }}
                </span>
                <button
                  @click.stop="emit('editGroup', child)"
                  class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 transition-opacity p-1"
                >
                  ✏️
                </button>
                <button
                  @click.stop="handleDeleteGroup(child)"
                  class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </template>
      </draggable>

      <!-- 空状态 -->
      <div v-if="rootGroups.length === 0" class="text-center py-8 text-gray-400 text-sm">
        暂无分组
      </div>
    </div>

    <!-- 新建分组按钮 -->
    <div class="p-3 border-t border-gray-200">
      <button
        @click="emit('editGroup', null)"
        class="w-full px-3 py-2 text-sm text-gray-600 hover:text-blue-500 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        <span>➕</span>
        <span>新建分组</span>
      </button>
    </div>
  </aside>
</template>