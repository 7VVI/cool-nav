// src/stores/docStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { docsApi } from '@/api/docs';
import type { SharedDoc, SharedDocCreatePayload } from '@/types';

export const useDocStore = defineStore('docs', () => {
  const docs = ref<SharedDoc[]>([]);
  const loading = ref(false);

  async function fetchDocs() {
    loading.value = true;
    try {
      const res = await docsApi.list();
      docs.value = res.data || [];
    } catch (e) {
      console.error('Failed to fetch docs:', e);
    } finally {
      loading.value = false;
    }
  }

  async function addDoc(payload: SharedDocCreatePayload) {
    const res = await docsApi.create(payload);
    if (res.data) {
      docs.value.unshift(res.data);
    }
    return res.data;
  }

  async function updateDocName(id: number, name: string) {
    const res = await docsApi.update(id, { name });
    if (res.data) {
      const doc = docs.value.find(d => d.id === id);
      if (doc) {
        doc.name = res.data.name;
      }
    }
    return res.data;
  }

  async function removeDoc(id: number) {
    await docsApi.remove(id);
    docs.value = docs.value.filter(d => d.id !== id);
  }

  async function reorderDocs(items: { id: number }[]) {
    await docsApi.reorder(items);
  }

  return { docs, loading, fetchDocs, addDoc, updateDocName, removeDoc, reorderDocs };
});
