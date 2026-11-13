# 微光 · Moment

一个纯前端的极简动态广场：写下此刻的想法并发布，所有内容只保存在你自己的浏览器里。

## 特性

- **发布动态**：昵称 + 280 字正文，实时剩余字数，`Ctrl / Cmd + Enter` 快捷发布
- **时间线**：按发布时间倒序展示，相对时间显示（刚刚 / N 分钟前 / 昨天 / M 月 D 日）
- **编辑**：卡片内就地修改，`Esc` 取消、`Ctrl / Cmd + Enter` 保存，保存后标记「已编辑」
- **互动**：点赞（可取消）、删除（二次确认）
- **本地持久化**：刷新或重开浏览器后数据仍在；存储不可用时自动降级并在顶栏提示
- **细节**：空状态引导、Toast 反馈、响应式布局、尊重 `prefers-reduced-motion`

## 运行

无需安装、无构建步骤，二选一：

1. 直接双击 `index.html`
2. 或启动任意静态服务器：

```bash
python -m http.server 8823
```

然后打开 <http://localhost:8823/index.html>。

## 数据存储

- 使用浏览器 `localStorage`，不会上传到任何服务器，也没有后端
- 键名：`moment.posts.v1`（动态列表）、`moment.author.v1`（昵称）
- 清除浏览器站点数据会一并删除全部动态

## 技术栈

原生 HTML + CSS + JavaScript，无框架、无第三方依赖、无网络请求。

## 目录结构

```text
.
├── index.html   # 页面结构
├── styles.css   # 样式、动效与响应式
└── app.js       # 数据层、渲染层与交互逻辑
```

## 浏览器支持

Chrome、Edge、Firefox、Safari 的最近两个大版本。
