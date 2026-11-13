<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { DEFAULT_AUTHOR, MAX_AUTHOR_LENGTH, MAX_LENGTH } from "../constants";
import { appendTopic, getAvatarGradient, getInitial, truncate } from "../utils/text";

const props = defineProps({
  author: { type: String, default: "" },
  maxLength: { type: Number, default: MAX_LENGTH },
});

const emit = defineEmits(["publish", "update:author"]);

const content = ref("");
const authorDraft = ref(props.author || "");
const contentEl = ref(null);

watch(
  () => props.author,
  (value) => {
    authorDraft.value = value || "";
  }
);

const remaining = computed(() => props.maxLength - content.value.length);
const canPublish = computed(() => content.value.trim().length > 0);
const counterClass = computed(() => ({
  "is-warning": remaining.value <= 40 && remaining.value > 10,
  "is-danger": remaining.value <= 10,
}));

const avatarName = computed(() => authorDraft.value.trim() || DEFAULT_AUTHOR);
const avatarInitial = computed(() => getInitial(avatarName.value));
const avatarStyle = computed(() => ({ background: getAvatarGradient(avatarName.value) }));

function onAuthorInput(event) {
  const value = truncate(event.target.value.trim(), MAX_AUTHOR_LENGTH);
  if (event.target.value !== value) {
    event.target.value = value;
  }
  authorDraft.value = value;
  emit("update:author", value);
}

function publish() {
  if (!canPublish.value) {
    return;
  }

  emit("publish", {
    content: truncate(content.value.trim(), props.maxLength),
    author: authorDraft.value.trim(),
  });

  content.value = "";
  nextTick(() => {
    contentEl.value?.focus();
  });
}

function onKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    publish();
  }
}

/** 把热搜话题填入发布框并聚焦 */
function fillTopic(topic) {
  content.value = appendTopic(content.value, topic);
  nextTick(() => {
    const el = contentEl.value;
    if (!el) {
      return;
    }
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
}

defineExpose({ fillTopic });
</script>

<template>
  <section class="composer card" aria-labelledby="composerTitle">
    <h2 id="composerTitle" class="visually-hidden">发布新动态</h2>

    <div class="composer-avatar" :style="avatarStyle" aria-hidden="true">{{ avatarInitial }}</div>

    <div class="composer-body">
      <label class="visually-hidden" for="contentInput">动态内容</label>
      <textarea
        id="contentInput"
        ref="contentEl"
        v-model="content"
        class="composer-input"
        :maxlength="maxLength"
        rows="3"
        placeholder="此刻在想些什么？"
        aria-describedby="charCounter"
        @keydown="onKeydown"
      ></textarea>

      <div class="composer-toolbar">
        <label class="nickname-field" for="authorInput">
          <span class="nickname-label">昵称</span>
          <input
            id="authorInput"
            class="nickname-input"
            type="text"
            :maxlength="MAX_AUTHOR_LENGTH"
            :value="authorDraft"
            placeholder="我"
            autocomplete="off"
            aria-label="昵称"
            @input="onAuthorInput"
          />
        </label>

        <span id="charCounter" class="char-counter" :class="counterClass">{{ remaining }}</span>

        <button class="btn-publish" type="button" :disabled="!canPublish" @click="publish">
          <span>发布</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h13" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </section>
</template>
