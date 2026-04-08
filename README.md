# LLaMb Page Analyzer

`LLaMb Page Analyzer` 是一个基于 Chrome Manifest V3 的网页分析扩展。

这个项目的目标不是弹出一个独立聊天面板，而是：

- 采集当前网页上下文
- 对页面进行分类
- 根据页面类型选择不同注入策略
- 将分析结果插入真实网页 DOM 中
- 尽量伪装成页面原本就存在的模块

当前版本已经从“统一插入一张简介卡”的原型，演进为“**页面分类 + 子场景策略目录 + 自适应注入**”的结构化版本。

---

## 当前项目状态

当前项目已经具备以下能力：

- 页面上下文采集
- DOM 特征提取
- 页面分类
- 按页面类型选择策略
- 按子场景选择策略文件
- 本地 mock / 后端 LLM 双模式分析
- 页面内真实 DOM 注入
- 宿主页样式采样与一定程度的伪装注入
- 调试日志与 `window.__LLAMB_DEBUG__` 输出

当前重点已经不是“能不能插进去”，而是：

- 插到哪里更自然
- 哪种页面用哪种策略
- 后续如何方便地按页面类型继续细调

---

## 项目核心思路

当前主链路如下：

```text
页面上下文采集
-> DOM 特征提取
-> 页面分类
-> 选择页面类型策略
-> 若有子场景，再进入子场景策略
-> 构造 payload
-> 解析插入位置
-> 渲染并注入页面
-> 输出调试信息
```

这意味着：

- 页面分类只负责判断“这是什么页面”
- 真正的页面特化逻辑放在策略目录中
- 后续修改某类页面时，不需要再去改整个大文件

---

## 当前页面分类

当前系统支持以下页面类型：

- `article`：文章、新闻、博客正文页
- `feed`：信息流、推荐流、瀑布流页面
- `form`：登录、注册、搜索、填写类页面
- `product`：商品页、详情展示页
- `dashboard`：后台、控制台、面板页
- `video`：视频播放、视频详情页
- `generic`：无法明确归类的普通页面

其中，`form` 和 `feed` 已进一步拆分为子场景策略。

---

## 目录结构

```text
LLaMbChromeExt/
├─ manifest.json
├─ content/
│  ├─ bootstrap.js
│  ├─ shared/
│  │  ├─ namespace.js
│  │  └─ constants.js
│  └─ strategies/
│     └─ page-types/
│        ├─ article.js
│        ├─ feed.js
│        ├─ feed/
│        │  ├─ bilibili-home.js
│        │  ├─ video-site-home.js
│        │  └─ generic-feed.js
│        ├─ form.js
│        ├─ form/
│        │  ├─ login.js
│        │  ├─ register.js
│        │  ├─ search.js
│        │  ├─ survey.js
│        │  └─ default.js
│        ├─ product.js
│        ├─ dashboard.js
│        ├─ video.js
│        └─ generic.js
├─ background/
│  ├─ bootstrap.js
│  └─ modules/
│     ├─ runtime.js
│     ├─ settings.js
│     └─ analysis-service.js
├─ backend-example/
│  ├─ pageClassifier.js
│  ├─ strategyPlanner.js
│  ├─ promptBuilder.js
│  ├─ responseValidator.js
│  ├─ llmClient.js
│  └─ server.js
├─ sidebar.css
├─ popup.html
├─ popup.js
├─ settings.html
├─ settings.js
└─ ...
```

---

## 策略目录说明

### 一级页面类型策略

| 页面类型 | 文件 |
|---|---|
| `article` | `content/strategies/page-types/article.js` |
| `feed` | `content/strategies/page-types/feed.js` |
| `form` | `content/strategies/page-types/form.js` |
| `product` | `content/strategies/page-types/product.js` |
| `dashboard` | `content/strategies/page-types/dashboard.js` |
| `video` | `content/strategies/page-types/video.js` |
| `generic` | `content/strategies/page-types/generic.js` |

### 已细分的子场景

#### `form`

| 子场景 | 文件 |
|---|---|
| `login` | `content/strategies/page-types/form/login.js` |
| `register` | `content/strategies/page-types/form/register.js` |
| `search` | `content/strategies/page-types/form/search.js` |
| `survey` | `content/strategies/page-types/form/survey.js` |
| `default` | `content/strategies/page-types/form/default.js` |

#### `feed`

| 子场景 | 文件 |
|---|---|
| `bilibili-home` | `content/strategies/page-types/feed/bilibili-home.js` |
| `video-site-home` | `content/strategies/page-types/feed/video-site-home.js` |
| `generic-feed` | `content/strategies/page-types/feed/generic-feed.js` |

---

## 当前注入策略概况

### article
- 目标：在正文中插入摘要型内容
- 典型位置：标题后、第一段后、第二段后

### feed
- 目标：在信息流前部或稳定锚点附近插入上下文说明
- 典型位置：稳定顶部锚点、稳定卡片间，而不是持续增长的流尾部

### form
- 目标：在填写前给出引导说明
- 典型位置：第一组表单字段上方，也就是标题区和第一个输入项之间

### product
- 目标：在标题、价格、详情区附近补充信息

### dashboard
- 目标：在主内容区顶部插入紧凑说明模块

### video
- 目标：在播放器或标题区附近插入上下文卡片

### generic
- 目标：作为普通页面兜底，优先标题区或主内容前部

---

## 当前运行方式

### 1. 内容脚本加载

`manifest.json` 现在会按顺序加载：

1. `content/shared/namespace.js`
2. `content/shared/constants.js`
3. 子场景策略文件
4. 一级页面类型策略文件
5. `content/bootstrap.js`

这样做的好处是：

- 页面分类之后可以直接去对应目录找策略
- 子场景策略先注册，父级策略只负责路由
- 后续扩展不会再把逻辑堆回一个超大文件里

### 2. 后台加载

后台入口为：

- `background/bootstrap.js`

并使用以下模块：

- `background/modules/runtime.js`
- `background/modules/settings.js`
- `background/modules/analysis-service.js`

---

## mock 与 backend 模式

当前支持两种分析来源：

### mock 模式
- 本地直接生成分析内容
- 适合先调页面分类和注入位置
- 不依赖后端

### backend 模式
- 把页面上下文、分类结果、策略结果发给后端
- 后端再调用 LLM 返回结构化结果
- 适合做更丰富的内容生成

后端示例目录：
- `backend-example/`

示例后端支持：

- OpenAI 兼容接口
- 页面分类与策略提示字段输入
- 严格 JSON 结构校验
- 单卡片内容返回

---

## 如何运行

### 方式一：使用 mock 模式

1. 打开 Chrome
2. 进入 `chrome://extensions/`
3. 打开“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择当前项目目录
6. 打开扩展设置页
7. 勾选 `Use Mock Analysis`
8. 打开任意网页
9. 点击弹窗中的 `Analyze Current Page`

### 方式二：连接本地后端

1. 进入 `backend-example/`
2. 安装依赖并配置 `.env`
3. 启动后端
4. 在扩展设置页填写：
   - `Backend Analysis Endpoint`
   - `Backend Auth Token`（如有）
5. 关闭 `Use Mock Analysis`
6. 打开网页并执行分析

---

## 当前适合怎么继续开发

如果你后续要细调策略，建议直接按目录修改：

- 改注册页：`content/strategies/page-types/form/register.js`
- 改登录页：`content/strategies/page-types/form/login.js`
- 改问卷页：`content/strategies/page-types/form/survey.js`
- 改 B站首页推荐流：`content/strategies/page-types/feed/bilibili-home.js`
- 改通用信息流：`content/strategies/page-types/feed/generic-feed.js`

后续如果需要继续细分，建议优先扩展：

- `video/`
- `product/`
- `dashboard/`

例如继续拆成：

```text
content/strategies/page-types/video/
├─ bilibili-watch.js
├─ youtube-watch.js
└─ generic-video.js
```

---

## 当前项目边界

当前项目已经能做到：

- 修改真实网页 DOM
- 根据页面类型切换不同注入策略
- 根据子场景切换更细的策略文件
- 尽量贴近宿主页样式
- 输出结构化调试信息

当前仍然没有完全做到：

- 对所有网站都稳定完美适配
- 对每个站点都具备专项规则
- 完整复用宿主页现成组件系统

所以现在更准确的定位是：

**一个已经完成主链路、并且适合持续做页面类型专项优化的网页内自适应注入原型。**

---

## 相关文档

- `ARCHITECTURE_AND_PAGE_STRATEGIES_CN.md`
- `PAGE_CLASSIFICATION_AND_STRATEGIES.md`
- `PROJECT_COMPLETION_STATUS.md`
- `BACKEND_API.md`
- `CODEBASE_GUIDE.md`
- `DESIGN_SYSTEM.md`
- `backend-example/README.md`
