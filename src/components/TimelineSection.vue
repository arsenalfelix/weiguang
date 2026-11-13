<script setup>
import { computed } from "vue";
import { POST_FILTERS, POST_FILTER_LABELS } from "../constants";
import PostCard from "./PostCard.vue";

const props = defineProps({
  posts: { type: Array, default: () => [] },
  filter: { type: String, default: "all" },
  counts: { type: Object, default: () => ({ all: 0, liked: 0, bookmarked: 0 }) },
  editingId: { type: String, default: null },
  highlightId: { type: String, default: null },
  introPlayed: { type: Boolean, default: false },
  now: { type: Number, default: 0 },
});

const emit = defineEmits(["like", "bookmark", "filter", "edit", "save", "cancel", "delete"]);

const hasPosts = computed(() => props.posts.length > 0);
const isIntro = computed(() => !props.introPlayed && hasPosts.value);

const tabs = computed(() =>
  POST_FILTERS.map((value) => ({
    value,
    label: POST_FILTER_LABELS[value],
    count: Number(props.counts?.[value]) || 0,
  }))
);

const EMPTY_COPY = {
  all: {
    title: "还没有任何动态",
    desc: "写下第一条吧，它会留在本机的 Hono 服务里。",
  },
  liked: {
    title: "还没有点赞的动态",
    desc: "给喜欢的动态点赞，它们会集合在这里。",
  },
  bookmarked: {
    title: "还没有收藏的动态",
    desc: "收藏想稍后再看的动态，随时回来翻阅。",
  },
};

const emptyCopy = computed(() => EMPTY_COPY[props.filter] || EMPTY_COPY.all);
</script>

<template>
  <div class="stream">
    <div class="filter-tabs" role="tablist" aria-label="筛选动态">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="filter-tab"
        :class="{ 'is-active': filter === tab.value }"
        type="button"
        role="tab"
        :aria-selected="filter === tab.value"
        :data-filter="tab.value"
        @click="emit('filter', tab.value)"
      >
        <span>{{ tab.label }}</span>
        <span class="filter-count">{{ tab.count }}</span>
      </button>
    </div>

    <div class="section-divider">
      <span>{{ filter === "all" ? "时间线" : `我的${POST_FILTER_LABELS[filter] || ""}` }}</span>
      <span class="divider-line" aria-hidden="true"></span>
      <span class="post-total">{{ posts.length }} 条</span>
    </div>

    <section class="timeline" tabindex="-1" aria-label="动态时间线" :hidden="!hasPosts">
      <PostCard
        v-for="(post, index) in posts"
        :key="post.id"
        :post="post"
        :editing="editingId === post.id"
        :is-new="highlightId === post.id"
        :is-intro="isIntro"
        :index="index"
        :now="now"
        @like="emit('like', $event)"
        @bookmark="emit('bookmark', $event)"
        @edit="emit('edit', $event)"
        @save="emit('save', $event)"
        @cancel="emit('cancel', $event)"
        @delete="emit('delete', $event)"
      />
    </section>

    <div v-if="!hasPosts" class="empty-state">
      <div class="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 12h28a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H22l-9 7v-7h-3a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z" />
          <path d="M16 21h16M16 28h10" />
        </svg>
      </div>
      <h3 class="empty-title">{{ emptyCopy.title }}</h3>
      <p class="empty-desc">{{ emptyCopy.desc }}</p>
    </div>
  </div>
</template>
