// src/stores/authStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const TOKEN_KEY = 'cool-nav-token';
const TOKEN_EXPIRY_KEY = 'cool-nav-token-expiry';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  // 检查 token 是否过期
  function isTokenExpired(): boolean {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return true;
    return Date.now() > parseInt(expiry);
  }

  // 验证当前 token
  async function verifyToken(): Promise<boolean> {
    if (!token.value) return false;

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.value}`
        },
        body: JSON.stringify({ token: token.value })
      });

      const data = await res.json();
      if (!data.valid) {
        logout();
        return false;
      }
      return true;
    } catch (e) {
      console.error('Token verification failed:', e);
      return false;
    }
  }

  // 登录
  async function login(secret: string): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret })
      });

      const data = await res.json();

      if (!data.success) {
        error.value = data.message || '登录失败';
        return false;
      }

      token.value = data.data.token;
      localStorage.setItem(TOKEN_KEY, data.data.token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + data.data.expiresIn));

      return true;
    } catch (e) {
      console.error('Login failed:', e);
      error.value = '网络错误，请稍后重试';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // 登出
  function logout() {
    token.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  // 获取授权头
  function getAuthHeaders(): Record<string, string> {
    if (!token.value) return {};
    return { Authorization: `Bearer ${token.value}` };
  }

  return {
    token,
    loading,
    error,
    isAuthenticated,
    isTokenExpired,
    verifyToken,
    login,
    logout,
    getAuthHeaders
  };
});