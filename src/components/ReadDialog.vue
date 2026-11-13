<script setup>
import { computed, ref, watch } from "vue";
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
const emit = defineEmits(["close"]);

const dialogEl = ref(null);
let usedNativeModal = false;

const article = computed(() => ui.readArticle);
const metaText = computed(() =>
  article.value ? `${article.value.tag} · ${article.value.minutes} 分钟阅读` : ""
);

function openNative() {
  const el = dialogEl.value;
  if (!el) {
    return;
  }

  if (typeof el.showModal === "function" && !el.open) {
    try {
      el.showModal();
      usedNativeModal = true;
      return;
    } catch (error) {
      usedNativeModal = false;
    }
  }
  el.setAttribute("open", "");
}

function closeNative() {
  const el = dialogEl.value;
  if (!el) {
    return;
  }

  if (usedNativeModal && typeof el.close === "function") {
    try {
      el.close();
    } catch (error) {
      /* 忽略：不同环境实现差异 */
    }
  }
  el.removeAttribute("open");
  usedNativeModal = false;
}

watch(
  () => ui.readId,
  (id) => {
    if (id) {
      openNative();
    } else {
      closeNative();
    }
  },
  { flush: "post" }
);

function close() {
  if (!ui.readId) {
    return;
  }
  ui.closeRead();
  emit("close");
}

function onCancel(event) {
  event.preventDefault();
  close();
}

function onKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
}

function onClick(event) {
  if (event.target === dialogEl.value) {
    close();
  }
}
</script>

<template>
  <dialog
    id="readDialog"
    ref="dialogEl"
    class="read-dialog"
    aria-labelledby="readDialogTitle"
    @cancel="onCancel"
    @keydown="onKeydown"
    @click="onClick"
  >
    <div class="read-dialog-inner">
      <p class="read-dialog-meta">{{ metaText }}</p>
      <h2 id="readDialogTitle" class="read-dialog-title">{{ article?.title || "" }}</h2>
      <div class="read-dialog-body">
        <p v-for="(paragraph, index) in article?.paragraphs || []" :key="index">{{ paragraph }}</p>
      </div>
      <div class="read-dialog-foot">
        <span class="read-dialog-hint">本地示例内容，未联网</span>
        <button id="readDialogClose" class="btn-cancel" type="button" @click="close">关闭</button>
      </div>
    </div>
  </dialog>
</template>
