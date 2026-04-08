# 页面分类与注入方案说明

## 1. 文档目的

本文档说明当前项目如何对网页进行分类，以及针对不同页面类型采用什么样的注入方案。

目标不是追求一次性完美分类，而是通过一套可解释、可扩展、可回退的规则，使页面内注入行为更自然、更稳定。

---

## 2. 总体流程

当前页面分析与注入流程如下：

```text
页面上下文采集
-> DOM 特征提取
-> 页面分类
-> 策略选择
-> 构造注入 payload
-> 解析插入位置
-> 渲染并注入页面
-> 输出调试信息
```

其中：

- 页面上下文由 `content.js` 采集
- 页面分类由前端本地规则完成
- 策略选择由前端根据 `pageType` 固定映射
- mock / backend 只负责补充内容，不负责决定基础策略

当前还增加了一条统一的视觉约束：

- 所有策略都尽量避免把注入块放到页面最下面
- 如果原始锚点过于靠后，会回退到页面前部的视觉安全锚点
- 目标是在页面打开后的主要视觉范围内完成更自然的插入

当前还增加了一条伪装约束：

- 对 feed、视频、商品和部分普通页面，优先复用宿主页现有卡片元素的外层结构
- 注入块会尽量借用邻近宿主元素的标签和 class 外壳，而不是始终使用完全自定义卡片
- 目标是让插入内容更像页面原本就存在的模块

---

## 3. 页面分类输入

当前分类器主要依赖以下输入：

### 3.1 pageContext

包含：

- `url`
- `title`
- `selectedText`
- `mainContent`
- `anchors`
- `styleSignals`
- `behaviorSignals`

### 3.2 domFeatures

包含：

- `formCount`
- `inputCount`
- `buttonCount`
- `linkCount`
- `headingCount`
- `imageCount`
- `videoCount`
- `tableCount`
- `cardLikeCount`
- `listLikeCount`
- `sidebarExists`
- `hasSearchBox`
- `hasLoginHints`
- `hasCheckoutHints`
- `hasPlayerHints`
- `hasArticleHints`
- `hasDashboardHints`
- `textDensity`
- `interactiveDensity`
- `feedLikelihood`
- `textLength`

---

## 4. 当前页面分类类型

当前支持以下页面类型：

- `article`
- `feed`
- `form`
- `product`
- `dashboard`
- `video`
- `generic`

分类方式采用：

- 多类打分
- 取最高分结果
- 若没有明显命中，则回退到 `generic`

---

## 5. 各页面类型的判定依据

## 5.1 article

典型特征：

- 标题层级较多
- 主内容文本较长
- 表单和按钮较少
- URL 或标题中出现 `article/news/blog/post`
- 页面更像正文阅读场景

当前注入目标：

- 在不打断阅读节奏的前提下插入摘要型内容

当前策略：

- `strategyId`: `article-inline-summary`
- `placementMode`: `after-paragraph`
- `renderMode`: `card`
- `contentGoal`: `summary`

优先插入位置：

- 正文标题后
- 第一段或第二段正文后
- 正文自然段之间

---

## 5.2 feed

典型特征：

- 重复卡片结构较多
- 存在列表流或信息流容器
- 动态 feed 信号明显
- 单块内容不长但重复区块很多

当前注入目标：

- 插入一张不打断滚动节奏的上下文提示卡

当前策略：

- `strategyId`: `feed-midstream-card`
- `placementMode`: `between-cards`
- `renderMode`: `card`
- `contentGoal`: `context-note`

优先插入位置：

- 稳定卡片之间
- 中部空隙区域
- 非频繁刷新的锚点附近

动态滚动页补充规则：

- 当页面被识别为无限滚动或动态 feed 时，优先选择页面前部已有的稳定元素作为锚点
- 注入块会尽量紧贴这个稳定锚点之后插入
- 不优先插入持续增长的内容流内部
- 目标是避免随着页面继续加载内容而使注入块不断下移

---

## 5.3 form

典型特征：

- 表单存在
- 输入框数量较多
- 有搜索、登录、注册、提交等语义提示
- 页面目标明确偏“填写”或“操作”

当前注入目标：

- 提供轻量说明和填写提示，减少打断感

当前策略：

- `strategyId`: `form-context-help`
- `placementMode`: `near-form`
- `renderMode`: `compact-tip`
- `contentGoal`: `guide`

优先插入位置：

- 第一组表单字段上方
- 表单标题下方
- 提交按钮前
- 表单容器内部顶部

表单页补充规则：

- 当前优先目标不是“靠近表单”这种宽泛位置，而是“第一组表单字段之前”
- 对注册页、登录页、搜索页等页面，尽量插在标题区和第一个输入项之间
- 表单页定位会优先使用表单作用域内的锚点，而不是交给全局通用位置修正逻辑

---

## 5.4 product

典型特征：

- 图片较多
- 有价格、购买、购物车等提示
- 标题区、详情区、操作区并存
- 页面更像展示页或详情页

当前注入目标：

- 补充页面理解信息，不干扰主要操作区

当前策略：

- `strategyId`: `product-side-note`
- `placementMode`: `after-heading`
- `renderMode`: `inline-block`
- `contentGoal`: `highlight`

优先插入位置：

- 标题下方
- 价格附近
- 详情模块开头

---

## 5.5 dashboard

典型特征：

- 有明显侧边栏
- 统计卡、表格、模块密度高
- 交互密度较高但文本密度不高
- URL 或标题中带有 `dashboard/admin/console/panel`

当前注入目标：

- 在主内容顶部插入紧凑型说明面板

当前策略：

- `strategyId`: `dashboard-compact-panel`
- `placementMode`: `side-panel`
- `renderMode`: `banner`
- `contentGoal`: `context-note`

优先插入位置：

- 主内容区顶部
- 统计区后
- 表格区前

---

## 5.6 video

典型特征：

- 视频或播放器存在
- URL / 标题中带有 `video/watch/play`
- 页面结构可能包含播放器、简介区、推荐区

当前注入目标：

- 在视频主体附近补充上下文说明

当前策略：

- `strategyId`: `video-context-card`
- `placementMode`: `after-heading`
- `renderMode`: `card`
- `contentGoal`: `context-note`

优先插入位置：

- 播放器后
- 标题或简介区后
- 推荐列表前

---

## 5.7 generic

典型特征：

- 不明显属于其他分类
- 页面结构简单或信息量中等
- 没有强表单、强视频、强商品、强后台特征

当前注入目标：

- 作为通用场景兜底，同时尽量适配简单页面

当前策略：

- `strategyId`: `generic-fallback-card`
- 默认 `placementMode`: `fallback`
- 默认 `renderMode`: `card`
- 默认 `contentGoal`: `summary`

但当前项目对 `generic` 又细分出一个“简单页面”场景。

---

## 6. 简单页面专项方案

为了让“普通简单页面”也能更自然地实现环境注入，当前项目对 `generic` 页面增加了轻量画像：

### 6.1 简单页面判定条件

当页面满足以下多数特征时，会被视为简单页面场景：

- `feedLikelihood` 低
- 没有明显表单
- 没有视频
- 没有表格
- 卡片结构不多
- 标题层级不复杂
- 文本长度中等
- 交互密度较低

### 6.2 简单页面细分变体

当前会进一步给出轻量变体：

- `simple-page`
- `landing-page`
- `doc-page`
- `showcase-page`

这些变体不会改变大类 `pageType = generic`，但会影响：

- `renderMode`
- `contentGoal`
- 视觉表现
- 插入位置优先级

### 6.3 简单页面注入策略

当 `generic` 页面被识别为简单页面时：

- 插入位置更偏向标题或首段后
- 渲染方式会优先选 `inline-block` 或 `banner`
- 内容目标更偏向 `context-note` 或轻量 `summary`
- 注入块会更轻、更接近页面本身结构

这使得简单页面不再只是“兜底失败时塞一张卡”，而是能够实现基础的环境注入。

---

## 7. 不同页面类型的渲染方案

当前渲染模式包括：

- `card`
- `inline-block`
- `banner`
- `compact-tip`

### 7.1 card

适合：

- `article`
- `feed`
- `video`
- 部分 `generic`

特点：

- 信息完整
- 视觉上仍是一个独立内容块
- 适合正文场景和说明场景

### 7.2 inline-block

适合：

- `product`
- 简单 `generic` 页面

特点：

- 比标准卡片更轻
- 更像页面中的信息补充块
- 更适合轻量展示或说明区后注入

### 7.3 banner

适合：

- `dashboard`
- `landing-page` 类型的简单页面

特点：

- 更横向、更紧凑
- 更像一个页面级提示条或说明条
- 适合放在主内容区顶部

### 7.4 compact-tip

适合：

- `form`

特点：

- 体积更小
- 打断感更弱
- 更像辅助提示，而非正文说明卡

---

## 8. 当前页面类型与方案映射表

| 页面类型 | 策略 ID | 插入位置 | 渲染模式 | 内容目标 |
|---|---|---|---|---|
| article | article-inline-summary | 正文标题/段落后 | card | summary |
| feed | feed-midstream-card | 稳定卡片之间 | card | context-note |
| form | form-context-help | 表单标题/提交区附近 | compact-tip | guide |
| product | product-side-note | 标题/价格/详情区附近 | inline-block | highlight |
| dashboard | dashboard-compact-panel | 主内容区顶部 | banner | context-note |
| video | video-context-card | 播放器/简介区附近 | card | context-note |
| generic | generic-fallback-card | 标题或主内容容器 | card / inline-block / banner | summary / context-note |

---

## 9. 调试与验证方式

当前可以通过以下方式验证分类与策略是否生效：

1. 打开目标网页后点击 `Analyze Current Page`
2. 在页面 DevTools 中查看 `window.__LLAMB_DEBUG__`
3. 重点关注以下字段：
   - `classification.pageType`
   - `classification.scores`
   - `classification.reasons`
   - `strategy.strategyId`
   - `strategy.renderMode`
   - `placement.debugReason`
   - `payload.metadata`
   - `simplePageProfile`
4. 在 background Service Worker 日志中确认调度信息

---

## 10. 当前方案的特点

当前方案具备以下特点：

- 规则明确，容易解释
- 出错时可以回退到 `generic`
- 不依赖复杂模型即可运行
- 可以在前端先完成基础分类和策略控制
- 后续容易继续扩展新页面类型或新策略

---

## 11. 后续可以继续增强的方向

建议优先增强以下方向：

1. 增加站点级分类修正规则
2. 为 `generic` 页面增加更稳定的“首屏内容理解”能力
3. 强化复杂布局中的 placement 解析
4. 为不同 `renderMode` 增加更丰富的样式差异
5. 为每类页面建立专门的人工测试页面样本集
