<script setup>
import { computed } from "vue";
import PostCard from "./PostCard.vue";

const props = defineProps({
  posts: { type: Array, default: () => [] },
  editingId: { type: String, default: null },
  highlightId: { type: String, default: null },
  introPlayed: { type: Boolean, default: false },
  now: { type: Number, default: 0 },
});

const emit = defineEmits(["like", "edit", "save", "cancel", "delete"]);

const hasPosts = computed(() => props.posts.length > 0);
const isIntro = computed(() => !props.introPlayed && hasPosts.value);
</script>

<template>
  <div class="stream">
    <div class="section-divider">
      <span>时间线</span>
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
      <h3 class="empty-title">还没有任何动态</h3>
      <p class="empty-desc">写下第一条吧，它会留在本机的 Hono 服务里。</p>
    </div>
  </div>
</template>
