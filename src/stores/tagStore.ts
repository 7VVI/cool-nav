// src/stores/tagStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { tagsApi, type Tag } from '@/api/tags';

export const useTagStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([]);
  const loaded = ref(false);

  async function fetchTags() {
    if (loaded.value) return;
    try {
      const res = await tagsApi.getAll();
      tags.value = res.data || [];
      loaded.value = true;
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }

  async function refreshTags() {
    try {
      const res = await tagsApi.getAll();
      tags.value = res.data || [];
      loaded.value = true;
    } catch (error) {
      console.error('Failed to refresh tags:', error);
    }
  }

  function getTagByValue(value: string): Tag | undefined {
    return tags.value.find(t => t.value === value);
  }

  return {
    tags,
    loaded,
    fetchTags,
    refreshTags,
    getTagByValue
  };
});