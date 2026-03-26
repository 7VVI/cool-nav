<template>
  <div v-if="checking" class="checking-screen">
    <div class="spinner"></div>
  </div>
  <Login v-else-if="!authStore.isAuthenticated" />
  <Dashboard v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import Dashboard from '@/views/dashboard/index.vue';
import Login from '@/views/login/index.vue';

const authStore = useAuthStore();
const checking = ref(true);

onMounted(async () => {
  // 检查本地 token 是否有效
  if (authStore.token && !authStore.isTokenExpired()) {
    await authStore.verifyToken();
  } else {
    authStore.logout();
  }
  checking.value = false;
});
</script>

<style>
.checking-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b6ef8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>