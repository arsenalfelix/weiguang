<script setup>
import { computed, onMounted } from "vue";
import { THEME_LABELS } from "../constants";
import { usePostsStore } from "../stores/posts";
import { useThemeStore } from "../stores/theme";
import { useUiStore } from "../stores/ui";

const theme = useThemeStore();
const posts = usePostsStore();
const ui = useUiStore();

const themeTitle = computed(() => `切换主题（当前：${THEME_LABELS[theme.mode]}）`);
const serviceTitle = computed(() =>
  posts.serviceAvailable
    ? "数据由本地 Hono 服务提供"
    : "无法连接后端服务，刷新后重试"
);

function toggleTheme() {
  const mode = theme.cycle();
  ui.showToast(`主题：${THEME_LABELS[mode]}`);
}

onMounted(() => {
  theme.init();
});
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">M</div>
        <div class="brand-text">
          <h1 class="brand-name">微光</h1>
          <p class="brand-slogan">记录此刻，安静发光</p>
        </div>
      </div>

      <div class="topbar-actions">
        <button
          class="theme-toggle"
          type="button"
          :data-mode="theme.mode"
          :aria-label="`切换主题，当前：${THEME_LABELS[theme.mode]}`"
          :title="themeTitle"
          @click="toggleTheme"
        >
          <span class="theme-icon" data-mode="system" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="13" rx="2.5" />
              <path d="M8 20h8M12 17.5V20" />
            </svg>
          </span>
          <span class="theme-icon" data-mode="light" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4" />
            </svg>
          </span>
          <span class="theme-icon" data-mode="dark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7.2 7.2 0 1 0 10.5 10.5Z" />
            </svg>
          </span>
        </button>

        <div
          class="storage-state"
          :class="{ 'is-offline': !posts.serviceAvailable }"
          :title="serviceTitle"
        >
          <span class="dot" aria-hidden="true"></span>
          <span>{{ posts.serviceAvailable ? "服务在线" : "服务离线" }}</span>
        </div>
      </div>
    </div>
  </header>
</template>
