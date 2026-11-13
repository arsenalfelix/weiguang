<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { MAX_LENGTH } from "../constants";
import { getAvatarGradient, getInitial, truncate } from "../utils/text";
import { formatAbsoluteTime, formatRelativeTime } from "../utils/time";

const props = defineProps({
  post: { type: Object, required: true },
  editing: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  isIntro: { type: Boolean, default: false },
  index: { type: Number, default: 0 },
  now: { type: Number, default: 0 },
});

const emit = defineEmits(["like", "bookmark", "edit", "save", "cancel", "delete"]);

const draft = ref(props.post.content);
const editEl = ref(null);

watch(
  () => props.post.content,
  (value) => {
    draft.value = value;
  }
);

watch(
  () => props.editing,
  (editing) => {
    if (!editing) {
      return;
    }
    draft.value = props.post.content;
    nextTick(() => {
      const el = editEl.value;
      if (!el) {
        return;
      }
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }
);

const articleClass = computed(() => ({
  "is-editing": props.editing,
  "is-new": props.isNew && !props.editing,
  "is-intro": props.isIntro && !props.editing,
}));

const articleStyle = computed(() =>
  props.isIntro && !props.editing
    ? { animationDelay: `${Math.min(props.index * 45, 315)}ms` }
    : undefined
);

const bookmarkCount = computed(() => {
  const value = Number(props.post.bookmarks);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
});
const avatarInitial = computed(() => getInitial(props.post.author));
const avatarStyle = computed(() => ({ background: getAvatarGradient(props.post.author) }));
const relativeTime = computed(() => formatRelativeTime(props.post.createdAt, props.now || Date.now()));
const absoluteTime = computed(() => formatAbsoluteTime(props.post.createdAt));
const isoTime = computed(() => new Date(props.post.createdAt).toISOString());
const editedTitle = computed(() =>
  props.post.editedAt ? `最后修改于 ${formatAbsoluteTime(props.post.editedAt)}` : ""
);
const remaining = computed(() => MAX_LENGTH - draft.value.length);
const counterClass = computed(() => ({
  "is-warning": remaining.value <= 40 && remaining.value > 10,
  "is-danger": remaining.value <= 10,
}));

function save() {
  const value = truncate(draft.value.trim(), MAX_LENGTH);
  if (!value) {
    return;
  }
  emit("save", { id: props.post.id, content: value });
}

function cancel() {
  emit("cancel", props.post.id);
}

function onEditKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    cancel();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    save();
  }
}

function remove() {
  const confirmed = window.confirm("确定要删除这条动态吗？删除后无法恢复。");
  if (!confirmed) {
    return;
  }
  emit("delete", props.post.id);
}
</script>

<template>
  <article class="post" :class="articleClass" :style="articleStyle" :data-id="post.id">
    <div class="post-avatar" :style="avatarStyle" aria-hidden="true">{{ avatarInitial }}</div>

    <div class="post-main">
      <div class="post-head">
        <span class="post-author">{{ post.author }}</span>
        <time class="post-time" :datetime="isoTime" :title="absoluteTime">{{ relativeTime }}</time>
        <span v-if="post.editedAt" class="post-edited" :title="editedTitle">已编辑</span>
      </div>

      <div v-if="editing" class="post-edit">
        <textarea
          ref="editEl"
          v-model="draft"
          class="post-edit-input"
          :maxlength="MAX_LENGTH"
          rows="2"
          aria-label="编辑动态内容"
          @keydown="onEditKeydown"
        ></textarea>

        <div class="post-edit-toolbar">
          <span class="post-edit-counter" :class="counterClass">{{ remaining }}</span>
          <div class="post-edit-actions">
            <button class="btn-cancel" type="button" aria-label="取消编辑" @click="cancel">取消</button>
            <button class="btn-save" type="button" aria-label="保存修改" @click="save">保存</button>
          </div>
        </div>
      </div>

      <template v-else>
        <p class="post-content">{{ post.content }}</p>

        <div class="post-actions">
          <button
            class="like-btn"
            :class="{ 'is-liked': post.likedByMe }"
            type="button"
            :aria-pressed="post.likedByMe"
            :aria-label="`${post.likedByMe ? '取消点赞' : '点赞'}，${post.likes} 个赞`"
            @click="emit('like', post.id)"
          >
            <svg class="heart" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 4.65-7 9-7 9Z" />
            </svg>
            <span class="like-count">{{ post.likes }}</span>
          </button>

          <button
            class="bookmark-btn"
            :class="{ 'is-bookmarked': post.bookmarkedByMe }"
            type="button"
            :aria-pressed="post.bookmarkedByMe === true"
            :aria-label="`${post.bookmarkedByMe ? '取消收藏' : '收藏'}，${bookmarkCount} 个收藏`"
            @click="emit('bookmark', post.id)"
          >
            <svg class="bookmark" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4.2-7 4.2V5a1 1 0 0 1 1-1Z" />
            </svg>
            <span class="bookmark-count">{{ bookmarkCount }}</span>
          </button>

          <button class="edit-btn" type="button" aria-label="编辑这条动态" @click="emit('edit', post.id)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Zm10.5-14.5 3 3" />
            </svg>
            <span>编辑</span>
          </button>

          <button class="delete-btn" type="button" aria-label="删除这条动态" @click="remove">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
            </svg>
            <span>删除</span>
          </button>
        </div>
      </template>
    </div>
  </article>
</template>
