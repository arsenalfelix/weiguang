# 微光 · Moment

一个纯前端的极简动态广场：写下此刻的想法并发布，所有内容只保存在你自己的浏览器里。

项目以 **TDD（测试先行）** 的方式，从原生 HTML/CSS/JavaScript 改写为 **Vue 3 + Pinia + Vite**，数据依旧存放在 `localStorage`，没有任何后端与网络请求。

## 特性

- **发布动态**：昵称 + 280 字正文，实时剩余字数，`Ctrl / Cmd + Enter` 快捷发布
- **时间线**：按发布时间倒序展示，相对时间显示（刚刚 / N 分钟前 / 昨天 / M 月 D 日），每分钟自动刷新
- **编辑**：卡片内就地修改，`Esc` 取消、`Ctrl / Cmd + Enter` 保存，保存后标记「已编辑」，内容未变则不写入编辑时间
- **互动**：点赞（可取消）、删除（二次确认）
- **明暗主题**：浅色 / 深色 / 跟随系统三档切换，选择会被记住，刷新首屏不闪烁
- **热搜排行**：侧栏榜单，点击话题会把 `#话题#` 填入发布框并聚焦
- **推荐阅读**：侧栏卡片，点击打开站内弹层查看全文，支持遮罩与 `Esc` 关闭，关闭后焦点回到触发卡片
- **广告位**：纯 CSS 渐变展示位，带「广告」角标，不加载外部图片、不跳转链接
- **本地持久化**：刷新或重开浏览器后数据仍在；存储不可用时自动降级并在顶栏提示
- **细节**：空状态引导、Toast 反馈、响应式布局、尊重 `prefers-reduced-motion`

## 技术栈

| 层 | 选型 |
| --- | --- |
| 视图 | Vue 3（`<script setup>` 单文件组件） |
| 状态 | Pinia（`posts` / `theme` / `ui` 三个 store） |
| 构建 | Vite（产物使用相对路径，可托管在任意静态服务器） |
| 测试 | Vitest + jsdom + @vue/test-utils |
| 存储 | 浏览器 `localStorage`，通过可替换的适配器访问 |

## 运行

需要 Node.js **20.19+**（或 22.12+）。

```bash
npm install
npm run dev      # 本地开发预览
npm run test     # 运行全部测试（默认单次执行）
npm run test:watch
npm run build    # 产出 dist/ 静态文件
npm run preview  # 预览构建产物
```

## 测试与 TDD

所有功能都先写规格测试、再实现代码（Red → Green → Refactor）。测试分三层：

```text
tests/
├── setup.js                    # 每个用例前重置 Pinia、存储适配器与 DOM
├── helpers/memoryStorage.js    # 内存版 / 写入失败版存储适配器
├── unit/
│   ├── text.spec.js            # 截断、首字、哈希
│   ├── time.spec.js            # 相对 / 绝对时间、时间戳归一化
│   ├── post-domain.spec.js     # 动态规范化、创建、点赞、编辑
│   ├── storage.spec.js         # 存储适配器与降级
│   ├── stores/                 # posts / theme / ui 三个 store
│   └── components/             # TopBar、Composer、PostCard、Timeline、SidePanel、ReadDialog、Toast
└── integration/
    └── App.spec.js             # 发布 → 点赞 → 编辑 → 删除 → 持久化 / 降级 / 主题 / 阅读弹层
```

设计要点：

- **纯函数与副作用分离**：领域规则（`src/domain/post.js`）与格式化（`src/utils/*`）不依赖 DOM 与时间，测试时注入 `now` / `generateId`
- **存储可注入**：`src/services/storage.js` 暴露 `setStorageAdapter`，测试用内存适配器隔离真实 `localStorage`
- **时间可控**：相对时间函数接收 `now` 参数，避免用例受时区与时钟影响

## 目录结构

```text
.
├── index.html                  # 入口 HTML（含首屏主题预置脚本）
├── src/
│   ├── main.js                 # createApp + Pinia + 样式
│   ├── App.vue                 # 布局组装与业务流程
│   ├── constants.js            # 领域常量、存储键、主题配置
│   ├── components/             # TopBar / PostComposer / TimelineSection / PostCard / SidePanel / ReadDialog / ToastBar
│   ├── stores/                 # posts / theme / ui
│   ├── domain/post.js          # 动态领域模型
│   ├── services/storage.js     # localStorage 适配器
│   ├── utils/                  # text.js / time.js
│   ├── data/demo.js            # 侧栏内置演示数据
│   └── styles/                 # tokens.css（设计令牌） / main.css（组件与布局）
├── tests/                      # 单元 + 组件 + 集成测试
├── legacy-static/              # 改写前的原生实现归档（可直接双击 index.html）
├── .agents/skills/             # Vue 技能配置（来源登记在 skills-lock.json）
├── vite.config.js
└── vitest.config.js
```

> `legacy-static/` 保留了改写前的原生 HTML/CSS/JavaScript 版本，与 Vue 版共用同一套 `localStorage` 键，可作为迁移前后的对照；它不参与构建与测试。

## 数据存储

- 使用浏览器 `localStorage`，不会上传到任何服务器，也没有后端
- 键名与旧版保持一致，升级后可直接读取既有数据：
  - `moment.posts.v1`：动态列表
  - `moment.author.v1`：昵称
  - `moment.theme.v1`：主题偏好
- 清除浏览器站点数据会一并删除全部动态与偏好
- 侧栏的热搜、推荐阅读、广告位均为**本地内置的演示数据**，不代表真实榜单或真实商品

## 浏览器支持

Chrome、Edge、Firefox、Safari 的最近两个大版本。
