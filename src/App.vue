<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import PostComposer from "./components/PostComposer.vue";
import ReadDialog from "./components/ReadDialog.vue";
import SidePanel from "./components/SidePanel.vue";
import TimelineSection from "./components/TimelineSection.vue";
import ToastBar from "./components/ToastBar.vue";
import TopBar from "./components/TopBar.vue";
import { usePostsStore } from "./stores/posts";
import { useThemeStore } from "./stores/theme";
import { useUiStore } from "./stores/ui";

const REFRESH_INTERVAL = 60 * 1000;
const HIGHLIGHT_DURATION = 1700;

const posts = usePostsStore();
const theme = useThemeStore();
const ui = useUiStore();

const composer = ref(null);
const clock = ref(Date.now());

let refreshTimer = null;
let highlightTimer = null;
let introTimer = null;
let lastReadTrigger = null;

onMounted(async () => {
  theme.init();

  const ok = await posts.init();
  if (!ok) {
    ui.showToast("服务未连接，内容暂不可用");
  }

  // 每分钟刷新一次相对时间显示
  refreshTimer = window.setInterval(() => {
    clock.value = Date.now();
  }, REFRESH_INTERVAL);

  // 首屏入场动画播完后再关闭 intro 标记，避免中途打断动画
  introTimer = window.setTimeout(() => {
    posts.introPlayed = true;
  }, 700);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (highlightTimer) {
    window.clearTimeout(highlightTimer);
    highlightTimer = null;
  }
  if (introTimer) {
    window.clearTimeout(introTimer);
    introTimer = null;
  }
  theme.destroy();
});

// 新动态 / 编辑完成后高亮一段时间再淡出
watch(
  () => posts.highlightId,
  (id) => {
    if (!id) {
      return;
    }
    if (highlightTimer) {
      window.clearTimeout(highlightTimer);
    }
    highlightTimer = window.setTimeout(() => {
      posts.clearHighlight(id);
    }, HIGHLIGHT_DURATION);
  }
);

const OFFLINE_TOAST = "服务未连接，请稍后再试";

async function handlePublish({ content, author }) {
  const result = await posts.addPost({ content, author });

  if (result.status === "created") {
    // 只有服务端确认写入后才清空草稿，离线时保留用户已输入的内容
    composer.value?.clear();
    return;
  }

  if (result.status === "invalid") {
    ui.showToast("写点什么再发布吧");
  } else if (result.status === "offline") {
    ui.showToast(OFFLINE_TOAST);
  }
}

async function handleLike(id) {
  const result = await posts.toggleLike(id);
  if (result.status === "offline") {
    ui.showToast(OFFLINE_TOAST);
  }
}

async function handleBookmark(id) {
  const result = await posts.toggleBookmark(id);

  if (result.status === "ok") {
    ui.showToast(result.post.bookmarkedByMe ? "已收藏" : "已取消收藏");
    return;
  }
  if (result.status === "offline") {
    ui.showToast(OFFLINE_TOAST);
  }
}

function handleEdit(id) {
  posts.startEdit(id);
}

async function handleSave({ id, content }) {
  const result = await posts.saveEdit(id, content);

  if (result.status === "saved") {
    ui.showToast("已更新");
  } else if (result.status === "empty") {
    ui.showToast("写点什么再保存吧");
  } else if (result.status === "offline") {
    ui.showToast(OFFLINE_TOAST);
  }
}

function handleCancel() {
  posts.cancelEdit();
}

async function handleDelete(id) {
  const result = await posts.removePost(id);

  if (result.status === "deleted") {
    ui.showToast("已删除");
  } else if (result.status === "offline") {
    ui.showToast(OFFLINE_TOAST);
  }
}

function handlePickTopic(topic) {
  composer.value?.fillTopic(topic);
  window.scrollTo({ top: 0, behavior: "smooth" });
  ui.showToast("已填入话题，补上你的想法吧");
}

function handleOpenRead(id) {
  lastReadTrigger = document.activeElement;
  ui.openRead(id);
}

function handleDialogClose() {
  if (lastReadTrigger && typeof lastReadTrigger.focus === "function") {
    lastReadTrigger.focus();
  }
  lastReadTrigger = null;
}

function handleAdClick() {
  ui.showToast("这是示例广告位，暂不跳转");
}
</script>

<template>
  <div class="glow glow-a" aria-hidden="true"></div>
  <div class="glow glow-b" aria-hidden="true"></div>

  <TopBar />

  <main class="page">
    <div class="layout">
      <div class="main-col">
        <PostComposer
          ref="composer"
          :author="posts.author"
          @publish="handlePublish"
          @update:author="posts.updateAuthorDraft($event)"
        />

        <TimelineSection
          :posts="posts.visiblePosts"
          :filter="posts.filter"
          :counts="posts.filterCounts"
          :editing-id="posts.editingId"
          :highlight-id="posts.highlightId"
          :intro-played="posts.introPlayed"
          :now="clock"
          @like="handleLike"
          @bookmark="handleBookmark"
          @filter="posts.setFilter($event)"
          @edit="handleEdit"
          @save="handleSave"
          @cancel="handleCancel"
          @delete="handleDelete"
        />
      </div>

      <SidePanel
        @pick-topic="handlePickTopic"
        @open-read="handleOpenRead"
        @ad-click="handleAdClick"
      />
    </div>

    <footer class="page-footer">
      <p>数据由本机 Hono 服务内存保存 · 重启服务会清空</p>
    </footer>
  </main>

  <ReadDialog @close="handleDialogClose" />
  <ToastBar />
</template>
