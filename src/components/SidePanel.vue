<script setup>
import { HOT_TOPICS, READS } from "../data/demo";

const emit = defineEmits(["pick-topic", "open-read", "ad-click"]);
</script>

<template>
  <aside class="side-col" aria-label="发现更多">
    <section class="widget card" aria-labelledby="hotTitle">
      <div class="widget-head">
        <h2 id="hotTitle" class="widget-title">热搜排行</h2>
        <span class="widget-note">本地示例</span>
      </div>

      <ol class="hot-list">
        <li v-for="(item, index) in HOT_TOPICS" :key="item.title" class="hot-item">
          <span class="hot-rank" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span>
          <button
            class="hot-link"
            type="button"
            :aria-label="`把话题 #${item.title}# 填入发布框`"
            @click="emit('pick-topic', item.title)"
          >
            <span class="hot-title-row">
              <span class="hot-title">#{{ item.title }}#</span>
              <span class="hot-tag">{{ item.tag }}</span>
            </span>
            <span class="hot-heat">热度 {{ item.heat }}</span>
          </button>
        </li>
      </ol>
    </section>

    <section class="widget card" aria-labelledby="readTitle">
      <div class="widget-head">
        <h2 id="readTitle" class="widget-title">推荐阅读</h2>
        <span class="widget-note">共 {{ READS.length }} 篇</span>
      </div>

      <div class="read-list">
        <button
          v-for="item in READS"
          :key="item.id"
          class="read-card"
          type="button"
          aria-haspopup="dialog"
          @click="emit('open-read', item.id)"
        >
          <span class="read-tag">{{ item.tag }}</span>
          <span class="read-title">{{ item.title }}</span>
          <span class="read-excerpt">{{ item.excerpt }}</span>
          <span class="read-meta">{{ item.minutes }} 分钟阅读</span>
        </button>
      </div>
    </section>

    <section class="ad-slot" aria-label="广告位（示例）">
      <span class="ad-badge">广告</span>
      <p class="ad-eyebrow">示例广告位</p>
      <h3 class="ad-title">给桌面留一盏柔光</h3>
      <p class="ad-desc">纯 CSS 渐变占位，不加载外部图片，也不跳转任何链接。</p>
      <button class="ad-cta" type="button" @click="emit('ad-click')">了解详情</button>
    </section>
  </aside>
</template>
