# 给 Codex 的实现任务书：基于页面分类的自适应内容注入改造

## 1. 任务目标

请在**不推翻现有项目结构**的前提下，对当前 Chrome Manifest V3 扩展进行增量改造，使其从“统一插入一张页面简介卡”的原型，升级为“**先分类页面，再按类别选择不同注入策略**”的研究原型。

目标链路如下：

```text
采集页面上下文
-> 提取页面特征
-> 页面分类
-> 选择策略
-> 生成注入载荷
-> 执行页面内注入
-> 记录分类与注入结果
```

请优先保证：

1. **可运行**：改造后扩展依然能在 Chrome 中正常加载。
2. **可回退**：如果分类失败，仍然能退回到当前单卡片注入逻辑。
3. **可解释**：分类结果、命中特征、策略选择原因都能输出到日志。
4. **可扩展**：后续可以继续新增页面类别和策略，而不需要重写主流程。
5. **最小侵入改造**：尽量复用当前 `content.js`、`background.js`、`backend-example/` 的已有能力，不要大面积重构无关部分。

---

## 2. 项目现状假设

基于当前项目说明，可以默认已有这些基础能力：

- `content.js` 已能提取页面 URL、标题、选中文本、主内容文本、结构锚点、样式信号、行为信号。
- `content.js` 已能识别动态 feed / 无限滚动页面。
- `content.js` 已能识别顶部 `fixed/sticky` 导航并做避让。
- `content.js` 已能在网页正文流中插入真实 DOM 内容。
- `background.js` 已能调度内容脚本、收集 `pageContext`、调用 mock 或后端分析。
- `backend-example/` 已能接收页面上下文、调用 LLM、返回结构化结果。
- 当前渲染目标主要是一张“页面简介卡”。

本次改造的重点不是推倒重写，而是在现有链路中插入两层：

- **Page Classifier（页面分类器）**
- **Strategy Selector（策略选择器）**

---

## 3. 重要约束

### 3.1 必须遵守

1. 不要删除当前可运行的主链路。
2. 不要破坏当前 `mock` 模式和 `backend` 模式。
3. 不要把所有逻辑堆进一个超大函数里。
4. 新增逻辑应尽量模块化，并保留合理注释。
5. 对分类失败、特征不足、DOM 不稳定等情况要有兜底逻辑。

### 3.2 本次不做

1. 不做站点级深度定制。
2. 不做复杂机器学习分类器。
3. 不做远程数据库。
4. 不做多页面历史记忆。

本次只做：

- 本地规则分类
- 基于分类的策略选择
- 注入模板切换
- 分类/策略日志记录

---

## 4. 要实现的核心能力

## 4.1 页面分类

请先实现一个**规则驱动的轻量页面分类器**，把页面分成以下几类：

```text
article        文章/新闻/博客正文页
feed           信息流/推荐流/瀑布流页面
form           表单/登录/搜索/填写页面
product        商品/详情/展示页面
dashboard      后台/控制台/仪表盘页面
video          视频播放/视频详情页面
generic        无法明确归类的普通页面
```

分类器不要求完美，但必须：

- 有明确输入和输出
- 能输出命中的特征和分类置信理由
- 分类失败时回退到 `generic`

### 4.1.1 分类输入

分类器输入至少包含：

```js
{
  url,
  title,
  selectedText,
  mainContent,
  anchors,
  styleSignals,
  behaviorSignals,
  domFeatures
}
```

其中 `domFeatures` 需要你新增提取，包括但不限于：

```js
{
  formCount,
  inputCount,
  buttonCount,
  linkCount,
  headingCount,
  imageCount,
  videoCount,
  tableCount,
  cardLikeCount,
  listLikeCount,
  sidebarExists,
  hasSearchBox,
  hasLoginHints,
  hasCheckoutHints,
  hasPlayerHints,
  hasArticleHints,
  hasDashboardHints,
  textDensity,
  interactiveDensity,
  feedLikelihood
}
```

### 4.1.2 分类规则建议

请先实现一个简单可解释的打分器，例如：

- `article`
  - `headingCount` 较高
  - 正文文本长度明显较长
  - 段落密度高
  - 表单与按钮较少
  - URL/title 含 `article/news/blog/post`

- `feed`
  - 存在明显 feed 容器
  - card/list 重复结构多
  - 动态滚动信号明显
  - 单条正文不长但重复内容块多

- `form`
  - `formCount/inputCount/buttonCount` 明显高
  - 含 `login/sign/register/search/submit`
  - 有多个 `input/select/textarea`

- `product`
  - 图片较多
  - 存在价格、购买、规格、加入购物车等语义特征
  - 详情区与操作区并存

- `dashboard`
  - 侧边栏明显
  - 表格、卡片、统计区较多
  - 文本密度不高但组件密度高
  - 含 `dashboard/panel/admin/console`

- `video`
  - 视频标签或播放器容器明显
  - 推荐列表 + 评论区 + 播放区结构明显
  - URL/title 含 `video/watch/play`

- `generic`
  - 其他都不明显时兜底

请实现成**多类打分 + 取最高分**，不要只写成 if-else 硬判断。

---

## 4.2 策略选择

页面分类完成后，请实现策略选择器 `selectInjectionStrategy(pageType, context)`。

输出应类似：

```js
{
  strategyId: "article-inline-summary",
  placementMode: "after-paragraph" | "after-heading" | "between-cards" | "near-form" | "side-panel" | "fallback",
  renderMode: "card" | "inline-block" | "banner" | "compact-tip",
  contentGoal: "summary" | "guide" | "highlight" | "context-note",
  riskLevel: "low",
  explanation: ["...", "..."]
}
```

### 4.2.1 第一版策略映射要求

先做固定映射，不需要 LLM 决策：

- `article`
  - `strategyId`: `article-inline-summary`
  - 插入位置优先：正文标题后、前两段后、正文中部自然段之间
  - 渲染方式：中等宽度卡片或内嵌摘要块

- `feed`
  - `strategyId`: `feed-midstream-card`
  - 插入位置优先：稳定卡片之间、中部白区、非动态刷新的区域
  - 渲染方式：单卡片，避免固定顶部横幅

- `form`
  - `strategyId`: `form-context-help`
  - 插入位置优先：表单标题下方、提交按钮上方、主要输入区旁边
  - 渲染方式：提示块、小型帮助块

- `product`
  - `strategyId`: `product-side-note`
  - 插入位置优先：标题区下方、价格区附近、详情模块起始处
  - 渲染方式：信息卡片

- `dashboard`
  - `strategyId`: `dashboard-compact-panel`
  - 插入位置优先：主内容区顶部、统计卡区之后、表格之前
  - 渲染方式：紧凑说明面板

- `video`
  - `strategyId`: `video-context-card`
  - 插入位置优先：播放器下方、简介区上方、推荐列表之前
  - 渲染方式：上下文说明卡

- `generic`
  - `strategyId`: `generic-fallback-card`
  - 使用当前已有通用插入逻辑

---

## 4.3 内容载荷构建

请实现一个统一的 `buildInjectionPayload()`，输入为：

```js
{
  pageType,
  strategy,
  pageContext,
  analysisResult
}
```

输出为：

```js
{
  title,
  body,
  badge,
  tone,
  icon,
  layoutHints,
  metadata
}
```

要求：

1. 即使后端没返回复杂内容，也能本地构造一个最小可渲染 payload。
2. payload 中要带上 `pageType` 与 `strategyId`，方便调试。
3. 保留当前 favicon、宿主页样式采样等已有能力。

建议在第一版里让不同页面类型的 payload 至少有这些差异：

- `article`: 更像“摘要 / 延伸说明”
- `feed`: 更像“上下文提示卡”
- `form`: 更像“填写说明 / 页面提示”
- `dashboard`: 更像“辅助面板”
- `product`: 更像“信息补充块”
- `video`: 更像“内容说明卡”

---

## 4.4 注入执行

请把当前单一注入逻辑拆成两个层次：

1. **placement resolver**：负责找插入位置
2. **renderer**：负责生成 DOM 并插入

### 4.4.1 placement resolver

新增：

```js
resolvePlacement(strategy, pageContext, domFeatures)
```

输出：

```js
{
  anchorElement,
  insertMode: "before" | "after" | "prepend" | "append",
  confidence,
  debugReason
}
```

要求：

- 文章页：优先正文标题后 / 正文段落后
- 信息流：优先稳定卡片之间
- 表单页：优先表单标题下方 / 提交区附近
- 控制台页：优先主内容顶部容器
- 视频页：优先播放器下方或简介区
- 找不到合适位置时退回当前通用插入逻辑

### 4.4.2 renderer

新增：

```js
renderInjectionCard(payload, styleProfile, strategy)
```

要求：

- 继续沿用现有“贴近宿主站风格”的思路
- 不要丢失 favicon、颜色采样、字体采样等已有能力
- 根据 `renderMode` 控制不同尺寸与布局
- 输出 DOM 节点时带上便于调试的属性，例如：

```html
<div
  data-llamb-injection="true"
  data-page-type="article"
  data-strategy-id="article-inline-summary"
>
```

---

## 4.5 日志与调试能力

必须新增调试输出，至少包括：

```js
{
  pageType,
  classifierScores,
  classifierReasons,
  selectedStrategy,
  placementReason,
  fallbackUsed,
  renderMode,
  timestamp
}
```

要求：

1. 在页面 DevTools 控制台可见。
2. 在 `background.js` 中也能看到核心调度日志。
3. 如果方便，可以把最近一次结果挂到 `window.__LLAMB_DEBUG__`。

例如：

```js
window.__LLAMB_DEBUG__ = {
  contextSummary: {...},
  domFeatures: {...},
  classification: {...},
  strategy: {...},
  placement: {...}
};
```

---

## 5. 具体文件改造要求

## 5.1 content.js

请重点改造 `content.js`，但不要把文件彻底打散重写。

### 至少新增这些函数

```js
function extractDomFeatures() {}
function scorePageType(pageContext, domFeatures) {}
function classifyPage(pageContext, domFeatures) {}
function selectInjectionStrategy(pageType, pageContext, domFeatures) {}
function buildInjectionPayload(input) {}
function resolvePlacement(strategy, pageContext, domFeatures) {}
function renderInjectionCard(payload, styleProfile, strategy) {}
function reportInjectionResult(debugInfo) {}
```

### 推荐执行顺序

```js
async function analyzeAndInject() {
  const pageContext = collectPageContext();
  const domFeatures = extractDomFeatures();
  const classification = classifyPage(pageContext, domFeatures);
  const strategy = selectInjectionStrategy(classification.pageType, pageContext, domFeatures);

  const analysisResult = await getAnalysisResultFromBackgroundOrMock({
    pageContext,
    domFeatures,
    classification,
    strategy
  });

  const payload = buildInjectionPayload({
    pageType: classification.pageType,
    strategy,
    pageContext,
    analysisResult
  });

  const placement = resolvePlacement(strategy, pageContext, domFeatures);
  renderInjectionCard(payload, pageContext.styleSignals, strategy, placement);
  reportInjectionResult({ pageContext, domFeatures, classification, strategy, placement, payload });
}
```

---

## 5.2 background.js

请改造为支持新的数据流，但保持兼容原有模式。

### 必做事项

1. 转发的数据不再只包含 `pageContext`，还应包括：

```js
{
  pageContext,
  domFeatures,
  classification,
  strategy
}
```

2. mock 模式下也要能根据 `pageType` 生成不同风格的 mock 结果。
3. 后端模式下，把分类结果一并传给后端。
4. 如果后端报错，前端仍然可以使用本地 fallback payload 注入。

---

## 5.3 backend-example/

请在示例后端中增加两个可选模块，但保持简单：

```text
backend-example/
├─ pageClassifier.js      // 可选，和前端保持一致或仅做校验
├─ strategyPlanner.js     // 根据 pageType 生成 prompt 辅助字段
├─ promptBuilder.js       // 增强 prompt，加入 pageType 和 strategy
└─ responseValidator.js   // 校验返回结果结构
```

### promptBuilder.js 改造要求

prompt 中要显式加入：

- 当前页面类别 `pageType`
- 当前策略 `strategyId`
- 内容目标 `contentGoal`
- 希望输出的卡片风格

例如要求 LLM 返回：

```json
{
  "title": "...",
  "body": "...",
  "badge": "...",
  "tone": "neutral",
  "renderMode": "card"
}
```

但同时要求：

- 如果后端拿不到这些字段，前端仍然能自己补默认值。

---

## 6. 数据结构定义

请在代码中明确这些对象结构，不要随意拼接散乱字段。

## 6.1 classification result

```js
{
  pageType: "article",
  scores: {
    article: 7,
    feed: 2,
    form: 1,
    product: 0,
    dashboard: 0,
    video: 0,
    generic: 1
  },
  reasons: [
    "mainContent length > threshold",
    "headingCount is high",
    "formCount is low"
  ],
  confidence: 0.82
}
```

## 6.2 strategy result

```js
{
  strategyId: "article-inline-summary",
  placementMode: "after-paragraph",
  renderMode: "card",
  contentGoal: "summary",
  explanation: [
    "pageType is article",
    "long text body detected"
  ]
}
```

## 6.3 payload

```js
{
  title: "页面摘要",
  body: "...",
  badge: "ARTICLE",
  tone: "neutral",
  icon: "favicon",
  layoutHints: {
    compact: false,
    emphasis: "medium"
  },
  metadata: {
    pageType: "article",
    strategyId: "article-inline-summary"
  }
}
```

---

## 7. 推荐实现顺序

请按下面顺序做，不要一上来就同时改所有地方。

### 第一步：补齐页面特征提取

在 `content.js` 中新增 `extractDomFeatures()`，先只做 DOM 特征统计。

验收标准：

- 打开任意页面后，控制台能看到 `domFeatures`
- 不影响现有注入功能

### 第二步：实现分类器

实现 `scorePageType()` 与 `classifyPage()`。

验收标准：

- 在至少 5 类不同页面上输出分类结果
- 即使分类不准，也必须稳定输出结构化结果

### 第三步：实现策略选择器

根据分类结果返回策略。

验收标准：

- 不同 `pageType` 至少返回不同 `strategyId`
- `generic` 能正常兜底

### 第四步：接入新的注入流程

把“分类 → 选策略 → 构造 payload → 解析位置 → 渲染”串起来。

验收标准：

- 现有注入仍然能工作
- 不同页面类型出现不同的插入位置或不同卡片形式

### 第五步：改造 background 与 mock

让 mock 模式支持基于 `pageType` 的差异化返回。

验收标准：

- 关闭后端后也能看到分类驱动的差异行为

### 第六步：后端 prompt 增强

把 `pageType`、`strategyId` 加入 prompt。

验收标准：

- 后端返回结构中能体现页面类型感知

### 第七步：补日志与调试面板

输出分类、策略、插入信息。

验收标准：

- DevTools 中可快速确认：页面被分到哪类、为什么、用了什么策略、插到了哪里

---

## 8. 需要给出的交付物

请最终输出这些内容：

1. 修改后的 `content.js`
2. 修改后的 `background.js`
3. 修改后的 `backend-example/promptBuilder.js`
4. 新增的辅助模块（如果你选择拆分）
5. 一份简短的 `README` 或变更说明，说明：
   - 新增了哪些函数
   - 新增了哪些字段
   - 页面分类规则是什么
   - 如何验证分类与策略是否生效

---

## 9. 验收标准

改造完成后，应满足：

### 功能验收

1. 扩展仍可正常加载。
2. 点击 Analyze 后，页面仍能完成注入。
3. 注入前会先输出页面分类结果。
4. 不同页面类型会触发不同策略。
5. 后端不可用时仍能 fallback。

### 代码验收

1. 新增逻辑有明确函数边界。
2. 没有把所有规则写死在一个大函数里。
3. 没有破坏原有 mock / backend 模式。
4. 日志结构清晰。

### 演示验收

请至少准备以下页面类型进行手动验证：

- 一篇文章页
- 一个登录或搜索表单页
- 一个信息流页
- 一个商品详情页或后台页
- 一个普通页面作为 generic

并验证：

- 分类结果是否合理
- 策略是否切换
- 插入位置是否有区别
- fallback 是否正常

---

## 10. 编码风格要求

1. 保持与现有项目风格接近。
2. 优先使用原生 JS，不额外引入重量级依赖。
3. 规则阈值集中管理，不要把 magic numbers 到处散落。
4. 对容易变动的规则写成常量或配置对象。
5. 注释重点写“为什么这样分”和“为什么这样选策略”。

建议增加类似：

```js
const PAGE_TYPE_THRESHOLDS = { ... };
const PAGE_TYPE_KEYWORDS = { ... };
const STRATEGY_MAP = { ... };
```

---

## 11. 建议的最小可运行版本

如果你不想一次改太多，请先做一个最小可运行版本：

### V1 只做这些

1. `extractDomFeatures()`
2. `classifyPage()`
3. `selectInjectionStrategy()`
4. `buildInjectionPayload()`
5. 在现有注入流程前插入这几步
6. 控制台输出完整 debug 信息

### V1 不强求

1. 不强求后端也有分类器
2. 不强求 renderMode 特别复杂
3. 不强求 placement resolver 极其精准

只要能做到：

- 页面能分类
- 不同类别触发不同策略 ID
- 注入结果能带上 `pageType` 和 `strategyId`
- generic 能兜底

就算第一阶段完成。

---

## 12. 直接执行要求

请直接开始改代码，不要先输出空泛方案。

你的执行原则是：

1. **先保证最小可运行版本跑通**。
2. **优先复用现有代码，而不是重写整套逻辑**。
3. **每改完一个阶段，就确保扩展不会因为语法错误而无法加载**。
4. **遇到不确定的现有函数命名时，优先查看并复用项目实际代码，而不是凭空假设**。
5. **不要修改与本任务无关的 UI 和样式文件，除非确实需要为不同 renderMode 增补少量样式。**

如果项目实际代码结构与本任务书略有不同，请遵循“**保持主链路不坏、最小侵入接入分类与策略层**”这个总原则。
