(function () {
  "use strict";

  /* ========== 常量 ========== */
  var STORAGE_POSTS_KEY = "moment.posts.v1";
  var STORAGE_AUTHOR_KEY = "moment.author.v1";
  var MAX_LENGTH = 280;
  var DEFAULT_AUTHOR = "我";

  /* ========== DOM 引用 ========== */
  var timelineEl = document.getElementById("timeline");
  var emptyStateEl = document.getElementById("emptyState");
  var postTotalEl = document.getElementById("postTotal");
  var contentInputEl = document.getElementById("contentInput");
  var authorInputEl = document.getElementById("authorInput");
  var publishBtnEl = document.getElementById("publishBtn");
  var charCounterEl = document.getElementById("charCounter");
  var composerAvatarEl = document.getElementById("composerAvatar");
  var storageStateEl = document.getElementById("storageState");
  var storageStateTextEl = document.getElementById("storageStateText");
  var toastEl = document.getElementById("toast");

  /* ========== 状态 ========== */
  var state = {
    posts: [],
    storageAvailable: true,
    editingId: null,
    highlightId: null,
    introPlayed: false
  };

  var toastTimer = null;

  /* ========== 工具函数 ========== */
  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function truncate(text, max) {
    if (text.length <= max) {
      return text;
    }
    var cut = text.slice(0, max);
    var lastCode = cut.charCodeAt(cut.length - 1);
    // 截断点落在代理对中间时回退一位，避免出现半个 Emoji
    if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
      cut = cut.slice(0, -1);
    }
    return cut;
  }

  function escapeId(id) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(id));
    }
    return String(id).replace(/["\\]/g, "\\$&");
  }

  function safeRead(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* 忽略：存储不可用时无需清理 */
    }
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2000);
  }

  function setStorageState(available) {
    state.storageAvailable = available;
    storageStateEl.classList.toggle("is-offline", !available);
    storageStateTextEl.textContent = available ? "本地存储" : "仅本次会话";
    storageStateEl.title = available
      ? "数据保存在本地浏览器"
      : "浏览器存储不可用，刷新后内容会丢失";
  }

  /* ========== 数据层 ========== */
  function normalizeTimestamp(value, fallback) {
    var now = Date.now();
    if (
      typeof value === "number" &&
      isFinite(value) &&
      value > 0 &&
      value <= now + 24 * 60 * 60 * 1000
    ) {
      return value;
    }
    return fallback;
  }

  function normalizePost(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    var content = typeof raw.content === "string" ? raw.content.trim() : "";
    if (!content) {
      return null;
    }
    var createdAt = normalizeTimestamp(raw.createdAt, Date.now());
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      author:
        typeof raw.author === "string" && raw.author.trim()
          ? truncate(raw.author.trim(), 12)
          : DEFAULT_AUTHOR,
      content: truncate(content, MAX_LENGTH),
      createdAt: createdAt,
      likes:
        typeof raw.likes === "number" && isFinite(raw.likes) && raw.likes >= 0
          ? Math.floor(raw.likes)
          : 0,
      likedByMe: raw.likedByMe === true,
      editedAt: normalizeTimestamp(raw.editedAt, null)
    };
  }

  function loadPosts() {
    var raw = safeRead(STORAGE_POSTS_KEY);
    if (!raw) {
      return [];
    }
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error("存储格式异常");
      }
      return parsed
        .map(normalizePost)
        .filter(Boolean)
        .sort(function (a, b) {
          return b.createdAt - a.createdAt;
        });
    } catch (err) {
      safeRemove(STORAGE_POSTS_KEY);
      return [];
    }
  }

  function persistPosts() {
    var ok = safeWrite(STORAGE_POSTS_KEY, JSON.stringify(state.posts));
    if (!ok && state.storageAvailable) {
      setStorageState(false);
      showToast("浏览器存储不可用，内容仅保留在本次会话");
    }
    return ok;
  }

  function loadAuthor() {
    var saved = safeRead(STORAGE_AUTHOR_KEY);
    if (saved && saved.trim()) {
      return truncate(saved.trim(), 12);
    }
    return "";
  }

  function persistAuthor(name) {
    safeWrite(STORAGE_AUTHOR_KEY, name);
  }

  /* ========== 展示层工具 ========== */
  function getAuthorName() {
    var value = authorInputEl.value.trim();
    return value ? truncate(value, 12) : DEFAULT_AUTHOR;
  }

  function getInitial(name) {
    var trimmed = (name || "").trim();
    if (!trimmed) {
      return "我";
    }
    return Array.from(trimmed)[0].toUpperCase();
  }

  function hashString(text) {
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 100000;
    }
    return hash;
  }

  var AVATAR_PALETTES = [
    ["#6366f1", "#a78bfa"],
    ["#0ea5e9", "#38bdf8"],
    ["#f59e0b", "#fbbf24"],
    ["#10b981", "#34d399"],
    ["#ec4899", "#f472b6"],
    ["#8b5cf6", "#c4b5fd"],
    ["#ef4444", "#fb923c"],
    ["#14b8a6", "#5eead4"]
  ];

  function applyAvatar(el, name) {
    var palette = AVATAR_PALETTES[hashString(name) % AVATAR_PALETTES.length];
    el.style.background = "linear-gradient(140deg, " + palette[0] + ", " + palette[1] + ")";
    el.textContent = getInitial(name);
  }

  function pad(number) {
    return number < 10 ? "0" + number : String(number);
  }

  function formatRelativeTime(timestamp) {
    var diff = Date.now() - timestamp;
    if (!isFinite(diff) || diff < 0) {
      diff = 0;
    }
    var minute = 60 * 1000;
    var hour = 60 * minute;
    var day = 24 * hour;

    if (diff < minute) {
      return "刚刚";
    }
    if (diff < hour) {
      return Math.floor(diff / minute) + " 分钟前";
    }
    if (diff < day) {
      return Math.floor(diff / hour) + " 小时前";
    }

    var date = new Date(timestamp);
    var now = new Date();
    var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    var calendarDays = Math.round((startOfToday - startOfDate) / day);

    if (calendarDays <= 1) {
      return "昨天";
    }
    if (calendarDays < 7) {
      return calendarDays + " 天前";
    }
    if (date.getFullYear() === now.getFullYear()) {
      return date.getMonth() + 1 + " 月 " + date.getDate() + " 日";
    }
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function formatAbsoluteTime(timestamp) {
    var date = new Date(timestamp);
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      " " +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes())
    );
  }

  function findPost(id) {
    return state.posts.find(function (item) {
      return item.id === id;
    });
  }

  /* ========== 渲染 ========== */
  function buildAvatar(name) {
    var el = document.createElement("div");
    el.className = "post-avatar";
    el.setAttribute("aria-hidden", "true");
    applyAvatar(el, name);
    return el;
  }

  function buildActionButton(options) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = options.className;
    btn.dataset.action = options.action;
    btn.dataset.id = options.id;
    btn.setAttribute("aria-label", options.ariaLabel);
    if (options.pressed !== undefined) {
      btn.setAttribute("aria-pressed", String(options.pressed));
    }

    if (options.icon) {
      btn.appendChild(options.icon);
    }

    var label = document.createElement("span");
    label.className = options.labelClass || "";
    label.textContent = options.label;
    btn.appendChild(label);

    return btn;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";

  function buildSvgIcon(pathData, className) {
    var svg = document.createElementNS(SVG_NS, "svg");
    if (className) {
      svg.setAttribute("class", className);
    }
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
  }

  function buildLikeIcon() {
    return buildSvgIcon("M12 20s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 4.65-7 9-7 9Z", "heart");
  }

  function buildEditIcon() {
    return buildSvgIcon("M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Zm10.5-14.5 3 3");
  }

  function buildDeleteIcon() {
    return buildSvgIcon("M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6");
  }

  function buildEditForm(post) {
    var wrap = document.createElement("div");
    wrap.className = "post-edit";

    var input = document.createElement("textarea");
    input.className = "post-edit-input";
    input.id = "edit-" + post.id;
    input.dataset.id = post.id;
    input.maxLength = MAX_LENGTH;
    input.rows = 2;
    input.value = post.content;
    input.setAttribute("aria-label", "编辑动态内容");

    var toolbar = document.createElement("div");
    toolbar.className = "post-edit-toolbar";

    var counter = document.createElement("span");
    counter.className = "post-edit-counter";
    counter.dataset.id = post.id;
    updateCharCounter(counter, post.content.length);

    var actions = document.createElement("div");
    actions.className = "post-edit-actions";

    actions.appendChild(
      buildActionButton({
        className: "btn-cancel",
        action: "cancel-edit",
        id: post.id,
        ariaLabel: "取消编辑",
        label: "取消"
      })
    );

    actions.appendChild(
      buildActionButton({
        className: "btn-save",
        action: "save-edit",
        id: post.id,
        ariaLabel: "保存修改",
        label: "保存"
      })
    );

    toolbar.appendChild(counter);
    toolbar.appendChild(actions);
    wrap.appendChild(input);
    wrap.appendChild(toolbar);
    return wrap;
  }

  function buildPost(post, options) {
    var isEditing = state.editingId === post.id;
    var article = document.createElement("article");
    article.className = "post" + (isEditing ? " is-editing" : "");
    article.dataset.id = post.id;

    if (!isEditing) {
      if (options && options.isNew) {
        article.classList.add("is-new");
      } else if (options && options.isIntro) {
        article.classList.add("is-intro");
        article.style.animationDelay = Math.min(options.index * 45, 315) + "ms";
      }
    }

    article.appendChild(buildAvatar(post.author));

    var main = document.createElement("div");
    main.className = "post-main";

    var head = document.createElement("div");
    head.className = "post-head";

    var author = document.createElement("span");
    author.className = "post-author";
    author.textContent = post.author;

    var time = document.createElement("time");
    time.className = "post-time";
    time.dateTime = new Date(post.createdAt).toISOString();
    time.title = formatAbsoluteTime(post.createdAt);
    time.textContent = formatRelativeTime(post.createdAt);

    head.appendChild(author);
    head.appendChild(time);

    if (post.editedAt) {
      var edited = document.createElement("span");
      edited.className = "post-edited";
      edited.textContent = "已编辑";
      edited.title = "最后修改于 " + formatAbsoluteTime(post.editedAt);
      head.appendChild(edited);
    }

    main.appendChild(head);

    if (isEditing) {
      main.appendChild(buildEditForm(post));
      article.appendChild(main);
      return article;
    }

    var content = document.createElement("p");
    content.className = "post-content";
    content.textContent = post.content;

    var actions = document.createElement("div");
    actions.className = "post-actions";

    actions.appendChild(
      buildActionButton({
        className: "like-btn" + (post.likedByMe ? " is-liked" : ""),
        action: "like",
        id: post.id,
        ariaLabel: (post.likedByMe ? "取消点赞" : "点赞") + "，" + post.likes + " 个赞",
        pressed: post.likedByMe,
        label: String(post.likes),
        labelClass: "like-count",
        icon: buildLikeIcon()
      })
    );

    actions.appendChild(
      buildActionButton({
        className: "edit-btn",
        action: "edit",
        id: post.id,
        ariaLabel: "编辑这条动态",
        label: "编辑",
        icon: buildEditIcon()
      })
    );

    actions.appendChild(
      buildActionButton({
        className: "delete-btn",
        action: "delete",
        id: post.id,
        ariaLabel: "删除这条动态",
        label: "删除",
        icon: buildDeleteIcon()
      })
    );

    main.appendChild(content);
    main.appendChild(actions);
    article.appendChild(main);

    return article;
  }

  function syncMeta() {
    var hasPosts = state.posts.length > 0;
    timelineEl.hidden = !hasPosts;
    emptyStateEl.hidden = hasPosts;
    postTotalEl.textContent = state.posts.length + " 条";
  }

  function scheduleHighlightClear() {
    if (!state.highlightId) {
      return;
    }
    var id = state.highlightId;
    state.highlightId = null;
    window.setTimeout(function () {
      var el = timelineEl.querySelector('[data-id="' + escapeId(id) + '"]');
      if (el) {
        el.classList.remove("is-new");
      }
    }, 1700);
  }

  function syncLikeButton(post) {
    var btn = timelineEl.querySelector('.like-btn[data-id="' + escapeId(post.id) + '"]');
    if (!btn) {
      return;
    }
    btn.classList.toggle("is-liked", post.likedByMe);
    btn.setAttribute("aria-pressed", String(post.likedByMe));
    btn.setAttribute(
      "aria-label",
      (post.likedByMe ? "取消点赞" : "点赞") + "，" + post.likes + " 个赞"
    );
    var count = btn.querySelector(".like-count");
    if (count) {
      count.textContent = String(post.likes);
    }
  }

  function renderTimeline() {
    var fragment = document.createDocumentFragment();
    var isIntro = !state.introPlayed && state.posts.length > 0;

    state.posts.forEach(function (post, index) {
      fragment.appendChild(
        buildPost(post, {
          isNew: post.id === state.highlightId,
          isIntro: isIntro,
          index: index
        })
      );
    });

    timelineEl.replaceChildren(fragment);
    state.introPlayed = true;
    syncMeta();
    scheduleHighlightClear();
  }

  function refreshTimes() {
    state.posts.forEach(function (post) {
      var el = timelineEl.querySelector('[data-id="' + escapeId(post.id) + '"] .post-time');
      if (el) {
        el.textContent = formatRelativeTime(post.createdAt);
      }
    });
  }

  /* ========== 发布 ========== */
  function updateCharCounter(el, length) {
    var remaining = MAX_LENGTH - length;
    el.textContent = String(remaining);
    el.classList.toggle("is-warning", remaining <= 40 && remaining > 10);
    el.classList.toggle("is-danger", remaining <= 10);
  }

  function updateCounter() {
    updateCharCounter(charCounterEl, contentInputEl.value.length);
    publishBtnEl.disabled = contentInputEl.value.trim().length === 0;
  }

  function autoGrowField(field) {
    field.style.height = "auto";
    field.style.height = field.scrollHeight + "px";
  }

  function publishPost() {
    var content = truncate(contentInputEl.value.trim(), MAX_LENGTH);

    if (!content) {
      showToast("写点什么再发布吧");
      return;
    }

    var author = getAuthorName();

    var post = {
      id: createId(),
      author: author,
      content: content,
      createdAt: Date.now(),
      likes: 0,
      likedByMe: false,
      editedAt: null
    };

    state.posts.unshift(post);
    state.editingId = null;
    state.highlightId = post.id;
    persistPosts();
    persistAuthor(author);
    renderTimeline();

    contentInputEl.value = "";
    autoGrowField(contentInputEl);
    updateCounter();
    contentInputEl.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ========== 编辑 ========== */
  function focusEditInput(id) {
    var input = timelineEl.querySelector('.post-edit-input[data-id="' + escapeId(id) + '"]');
    if (!input) {
      return;
    }
    autoGrowField(input);
    input.focus();
    var end = input.value.length;
    input.setSelectionRange(end, end);
  }

  function focusEditButton(id) {
    var btn = timelineEl.querySelector('.edit-btn[data-id="' + escapeId(id) + '"]');
    if (btn) {
      btn.focus();
      return;
    }
    timelineEl.focus();
  }

  function enterEditMode(id) {
    if (!findPost(id) || state.editingId === id) {
      return;
    }
    state.editingId = id;
    renderTimeline();
    focusEditInput(id);
  }

  function cancelEdit(id) {
    if (state.editingId !== id) {
      return;
    }
    state.editingId = null;
    renderTimeline();
    focusEditButton(id);
  }

  function saveEdit(id) {
    var post = findPost(id);
    var input = timelineEl.querySelector('.post-edit-input[data-id="' + escapeId(id) + '"]');
    if (!post || !input) {
      return;
    }

    var value = truncate(input.value.trim(), MAX_LENGTH);
    if (!value) {
      showToast("写点什么再保存吧");
      input.focus();
      return;
    }

    // 内容没有变化时只退出编辑态，不写入「已编辑」
    if (value === post.content) {
      cancelEdit(id);
      return;
    }

    post.content = value;
    post.editedAt = Date.now();
    state.editingId = null;
    state.highlightId = id;
    persistPosts();
    renderTimeline();
    showToast("已更新");
    focusEditButton(id);
  }

  /* ========== 交互事件 ========== */
  function handleTimelineClick(event) {
    var button = event.target.closest("[data-action]");
    if (!button || !timelineEl.contains(button)) {
      return;
    }

    var id = button.dataset.id;
    var action = button.dataset.action;

    if (action === "edit") {
      enterEditMode(id);
      return;
    }

    if (action === "save-edit") {
      saveEdit(id);
      return;
    }

    if (action === "cancel-edit") {
      cancelEdit(id);
      return;
    }

    var post = findPost(id);
    if (!post) {
      return;
    }

    if (action === "like") {
      post.likedByMe = !post.likedByMe;
      post.likes = Math.max(0, post.likes + (post.likedByMe ? 1 : -1));
      persistPosts();
      syncLikeButton(post);
      return;
    }

    if (action === "delete") {
      var confirmed = window.confirm("确定要删除这条动态吗？删除后无法恢复。");
      if (!confirmed) {
        return;
      }

      var article = timelineEl.querySelector('[data-id="' + escapeId(id) + '"]');
      var nextButton = null;
      if (article) {
        var sibling = article.nextElementSibling || article.previousElementSibling;
        nextButton = sibling ? sibling.querySelector(".edit-btn") : null;
        article.remove();
      }

      state.posts = state.posts.filter(function (item) {
        return item.id !== id;
      });
      if (state.editingId === id) {
        state.editingId = null;
      }
      persistPosts();
      syncMeta();
      showToast("已删除");

      // 若还有另一条正在编辑，焦点回到它的输入框
      if (state.editingId) {
        focusEditInput(state.editingId);
        return;
      }

      if (nextButton) {
        nextButton.focus();
      } else {
        contentInputEl.focus();
      }
    }
  }

  function handleTimelineInput(event) {
    var input = event.target;
    if (!input.classList || !input.classList.contains("post-edit-input")) {
      return;
    }
    var counter = timelineEl.querySelector(
      '.post-edit-counter[data-id="' + escapeId(input.dataset.id) + '"]'
    );
    if (counter) {
      updateCharCounter(counter, input.value.length);
    }
    autoGrowField(input);
  }

  function handleTimelineKeydown(event) {
    var input = event.target;
    if (!input.classList || !input.classList.contains("post-edit-input")) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit(input.dataset.id);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveEdit(input.dataset.id);
    }
  }

  function handleComposerKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      publishPost();
    }
  }

  /* ========== 初始化 ========== */
  function init() {
    state.posts = loadPosts();

    var savedAuthor = loadAuthor();
    if (savedAuthor) {
      authorInputEl.value = savedAuthor;
    }

    // 探测 localStorage 是否可用（隐私模式下写入可能抛错）
    var probeKey = "moment.probe";
    var probeOk = safeWrite(probeKey, "1") && safeRead(probeKey) === "1";
    safeRemove(probeKey);
    setStorageState(probeOk);

    updateCounter();
    autoGrowField(contentInputEl);
    applyAvatar(composerAvatarEl, getAuthorName());
    renderTimeline();

    contentInputEl.addEventListener("input", function () {
      updateCounter();
      autoGrowField(contentInputEl);
    });

    contentInputEl.addEventListener("keydown", handleComposerKeydown);
    publishBtnEl.addEventListener("click", publishPost);

    authorInputEl.addEventListener("input", function () {
      applyAvatar(composerAvatarEl, authorInputEl.value.trim() || DEFAULT_AUTHOR);
    });

    // 昵称在失焦时落盘，避免每次按键都写 localStorage
    authorInputEl.addEventListener("change", function () {
      persistAuthor(authorInputEl.value.trim());
    });

    timelineEl.addEventListener("click", handleTimelineClick);
    timelineEl.addEventListener("input", handleTimelineInput);
    timelineEl.addEventListener("keydown", handleTimelineKeydown);

    window.setInterval(refreshTimes, 60 * 1000);

    if (!probeOk) {
      showToast("浏览器存储不可用，内容仅保留在本次会话");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
