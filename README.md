# 微光 · Moment

一个极简的个人动态广场：写下此刻的想法并发布，数据由本机的 **Hono REST 服务**持有。
项目以 **TDD（测试先行）** 的方式演进：先由原生 HTML/CSS/JavaScript 改写为 **Vue 3 + Pinia + Vite**，
再把 `localStorage` 的业务数据存储替换为 **Hono + RESTful API + 进程内内存存储**。

## 特性

- **发布动态**：昵称 + 280 字正文，实时剩余字数，`Ctrl / Cmd + Enter` 快捷发布
- **时间线**：按发布时间倒序展示，相对时间显示（刚刚 / N 分钟前 / 昨天 / M 月 D 日），每分钟自动刷新
- **编辑**：卡片内就地修改，`Esc` 取消、`Ctrl / Cmd + Enter` 保存，保存后标记「已编辑」，内容未变则不写入编辑时间
- **互动**：点赞（可取消）、收藏（可取消）、删除（二次确认），点赞与收藏互不影响
- **筛选视图**：时间线顶部切换「全部 / 点赞 / 收藏」，标签实时显示各自数量，空视图有对应引导文案
- **明暗主题**：浅色 / 深色 / 跟随系统三档切换，选择会被记住，刷新首屏不闪烁
- **热搜排行**：侧栏榜单，点击话题会把 `#话题#` 填入发布框并聚焦
- **推荐阅读**：侧栏卡片，点击打开站内弹层查看全文，支持遮罩与 `Esc` 关闭，关闭后焦点回到触发卡片
- **广告位**：纯 CSS 渐变展示位，带「广告」角标，不加载外部图片、不跳转链接
- **服务端持久化**：同一服务进程内数据共享，刷新页面或换标签页仍能看到全部动态
- **连接降级**：后端不可用时顶栏标记「服务离线」并给出提示，不会静默回退到本地存储
- **细节**：空状态引导、Toast 反馈、响应式布局、尊重 `prefers-reduced-motion`

## 技术栈

| 层 | 选型 |
| --- | --- |
| 视图 | Vue 3（`<script setup>` 单文件组件） |
| 状态 | Pinia（`posts` / `theme` / `ui` 三个 store） |
| 构建 | Vite（dev / preview 通过中间件挂载同一份 Hono 应用） |
| 后端 | Hono 4 + `@hono/node-server`，RESTful JSON API |
| 存储 | 进程内内存仓储（`Map`），服务重启即清空 |
| 测试 | Vitest（jsdom 前端 + node 服务端）+ @vue/test-utils |

## 运行

需要 Node.js **20.19+**（或 22.12+）。

```bash
npm install
npm run dev      # Vite dev server，同时挂载 /api（默认 http://localhost:5173）
npm run test     # 运行全部测试（前端 jsdom + 服务端 node）
npm run test:watch
npm run build    # 产出 dist/ 静态文件
npm run preview  # 预览构建产物，/api 同样由中间件提供
npm start        # 独立运行 Hono 服务（默认 8787，NODE_ENV=production 时托管 dist/）
```

`npm run dev` 与 `npm run preview` 通过 `vite.config.js` 里的 `honoApiPlugin` 把 Hono 应用挂到
中间件上，因此页面与接口同源，无需额外启动进程或配置 CORS。

## API

所有接口位于 `/api`，请求与响应均为 JSON；错误统一为 `{ error: { code, message } }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/posts` | 动态列表，`createdAt` 倒序 |
| POST | `/api/posts` | 发布动态，`201`；内容为空 `422 EMPTY_CONTENT` |
| GET | `/api/posts/:id` | 单条动态 |
| PATCH | `/api/posts/:id` | 编辑，返回 `{ post, changed }` |
| DELETE | `/api/posts/:id` | 删除，`204` |
| PUT | `/api/posts/:id/likes` | 点赞（幂等） |
| DELETE | `/api/posts/:id/likes` | 取消点赞（幂等） |
| PUT | `/api/posts/:id/bookmarks` | 收藏（幂等） |
| DELETE | `/api/posts/:id/bookmarks` | 取消收藏（幂等） |
| GET | `/api/profile` | 读取昵称 |
| PUT | `/api/profile` | 更新昵称 |

示例：

```bash
curl -X POST http://localhost:8787/api/posts \
  -H 'content-type: application/json' \
  -d '{"content":"第一条动态","author":"小光"}'
```

## 测试与 TDD

所有功能都先写规格测试、再实现代码（Red → Green → Refactor）。测试分四层：

```text
tests/
├── setup.js                    # 每个用例前重置 Pinia、存储适配器、api client 与 DOM
├── helpers/
│   ├── memoryStorage.js        # 内存版 / 写入失败版 Web Storage 适配器
│   └── testApi.js              # 内存仓储 + Hono app + 直连 client，测试不经过真实网络
├── unit/
│   ├── text.spec.js            # 截断、首字、哈希
│   ├── time.spec.js            # 相对 / 绝对时间、时间戳归一化
│   ├── post-domain.spec.js     # 动态规范化、创建、点赞、收藏、编辑
│   ├── storage.spec.js         # 主题偏好的存储适配器与降级
│   ├── services/api.spec.js    # HTTP 客户端：请求构造、解包、ApiError 映射
│   ├── stores/                 # posts / theme / ui 三个 store
│   └── components/             # TopBar、Composer、PostCard、Timeline、SidePanel、ReadDialog、Toast
├── server/
│   ├── repository.spec.js      # 内存仓储：排序、副本隔离、编辑/点赞/收藏幂等、播种
│   ├── posts.api.spec.js       # REST 契约：状态码、错误码、CORS、异常兜底
│   └── testApi.spec.js         # 前端 client ↔ Hono app 的桥接
└── integration/
    └── App.spec.js             # 发布 → 点赞 → 编辑 → 删除 → 重新挂载 / 离线降级 / 主题 / 阅读弹层
```

设计要点：

- **纯函数与副作用分离**：领域规则（`src/domain/post.js`）与格式化（`src/utils/*`）不依赖 DOM、时间与网络，
  服务端与前端共用同一份规则，避免两端校验口径漂移
- **仓储不持有框架**：`server/repository.js` 只依赖注入的 `now` / `generateId`，返回普通对象副本，
  测试可以完全控制时间并验证隔离性
- **存储可注入**：`src/services/api.js` 暴露 `setApiClient`，store 与集成测试注入 `createTestApi()`
  的内存后端，避免真实网络与端口占用
- **错误集中降级**：客户端把 HTTP/网络异常统一转换为 `ApiError`，store 再把失败折叠成
  `offline` 状态，组件只处理业务状态字符串
- **时间可控**：相对时间函数接收 `now` 参数，避免用例受时区与时钟影响

## 目录结构

```text
.
├── index.html                  # 入口 HTML（含首屏主题预置脚本）
├── server/
│   ├── app.js                  # Hono 应用与 REST 路由装配
│   ├── repository.js           # 进程内内存仓储
│   └── index.js                # 独立运行入口（生产模式托管 dist/）
├── src/
│   ├── main.js                 # createApp + Pinia + 样式
│   ├── App.vue                 # 布局组装与业务流程
│   ├── constants.js            # 领域常量、主题配置
│   ├── components/             # TopBar / PostComposer / TimelineSection / PostCard / SidePanel / ReadDialog / ToastBar
│   ├── stores/                 # posts（REST）/ theme / ui
│   ├── domain/post.js          # 动态领域模型（前后端共用）
│   ├── services/
│   │   ├── api.js              # HTTP 客户端
│   │   └── storage.js          # 主题偏好的 localStorage 适配器
│   ├── utils/                  # text.js / time.js
│   ├── data/demo.js            # 侧栏内置演示数据
│   └── styles/                 # tokens.css（设计令牌） / main.css（组件与布局）
├── tests/                      # 单元 + 组件 + 服务端 + 集成测试
├── legacy-static/              # 改写前的原生实现归档（可直接双击 index.html）
├── vite.config.js              # Vue 插件 + Hono API 中间件
└── vitest.config.js
```

> `legacy-static/` 保留了最初的原生 HTML/CSS/JavaScript 版本，与 Vue 版共用同一套 `localStorage` 键，
> 可作为迁移前后的对照；它不参与构建与测试。

## 数据存储

- 动态与昵称由 `server/repository.js` 保存在**进程内存**中：同一服务进程内所有页面共享，重启即清空
- 内存存储是刻意的取舍：没有数据库与迁移成本，适合演示与本地开发；需要长期保存时应替换仓储实现
- 主题偏好与浏览器相关，仍保存在 `localStorage`（`moment.theme.v1`），不进入后端
- 前端**不再**从 `localStorage` 读写动态；后端不可用时直接降级为「服务离线」，不会写本地副本
- 侧栏的热搜、推荐阅读、广告位均为**本地内置的演示数据**，不代表真实榜单或真实商品

## 浏览器支持

Chrome、Edge、Firefox、Safari 的最近两个大版本。
