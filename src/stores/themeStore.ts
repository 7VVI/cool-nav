// src/stores/themeStore.ts
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem('theme-mode') as ThemeMode) || 'system');

  // 计算实际生效的主题
  const effectiveTheme = computed(() => {
    if (mode.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode.value;
  });

  // 应用主题到 DOM
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', effectiveTheme.value);
  }

  // 设置主题模式
  function setMode(newMode: ThemeMode) {
    mode.value = newMode;
    localStorage.setItem('theme-mode', newMode);
    applyTheme();
  }

  // 初始化：监听系统主题变化
  function init() {
    applyTheme();

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (mode.value === 'system') {
        applyTheme();
      }
    });

    // 监听本地模式变化
    watch(mode, () => {
      applyTheme();
    });
  }

  // 切换主题（快捷切换）
  function toggle() {
    const current = effectiveTheme.value;
    setMode(current === 'dark' ? 'light' : 'dark');
  }

  return {
    mode,
    effectiveTheme,
    setMode,
    toggle,
    init
  };
});