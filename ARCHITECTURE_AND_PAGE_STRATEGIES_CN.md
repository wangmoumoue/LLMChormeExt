# 项目架构与页面分类策略说明

## 1. 重构目标

本次重构的目标是把原先偏集中的脚本结构，调整为“分类、策略、渲染、后台调度”边界更清晰的目录结构，方便后续对不同页面类型进行二次开发。

重构后的核心原则是：

1. 页面分类先统一完成
2. 分类结果只负责告诉系统“这是什么页面”
3. 真正的页面注入策略放到对应页面类型目录下
4. 页面类型内部还可以继续细分子场景目录
5. 后续要修改某一类页面行为时，只需要进入对应页面类型或子场景策略文件修改

---

## 2. 当前目录结构

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
│        ├─ feed.js                        # feed 父级路由器
│        ├─ feed/
│        │  ├─ bilibili-home.js           # B站首页/推荐流
│        │  ├─ video-site-home.js         # 视频站首页流
│        │  └─ generic-feed.js            # 通用信息流
│        ├─ form.js                        # form 父级路由器
│        ├─ form/
│        │  ├─ login.js                   # 登录页
│        │  ├─ register.js                # 注册页
│        │  ├─ search.js                  # 搜索页
│        │  ├─ survey.js                  # 问卷/填写页
│        │  └─ default.js                 # 通用表单页
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
└─ ...
```

---

## 3. 当前运行方式

### 3.1 内容脚本加载方式

现在 `manifest.json` 会按以下顺序加载：

1. `content/shared/namespace.js`
2. `content/shared/constants.js`
3. 子场景策略文件
4. 页面类型父级策略文件
5. `content/bootstrap.js`

这意味着：

- 子场景策略先注册
- 父级页面策略负责“判断当前属于哪个子场景”
- 主流程只关心 `pageType`
- 页面类型内部的细分逻辑由各自父级路由器负责

---

## 4. 当前页面分类

当前系统支持以下页面分类：

- `article`
- `feed`
- `form`
- `product`
- `dashboard`
- `video`
- `generic`

分类逻辑由内容脚本主流程统一完成。

分类完成后：

- 先找到页面类型父级策略文件
- 再由父级策略文件判断是否命中更细的子场景

---

## 5. 页面类型与策略目录映射

### 5.1 一级页面类型映射

| 页面类型 | 父级策略文件 |
|---|---|
| `article` | `content/strategies/page-types/article.js` |
| `feed` | `content/strategies/page-types/feed.js` |
| `form` | `content/strategies/page-types/form.js` |
| `product` | `content/strategies/page-types/product.js` |
| `dashboard` | `content/strategies/page-types/dashboard.js` |
| `video` | `content/strategies/page-types/video.js` |
| `generic` | `content/strategies/page-types/generic.js` |

### 5.2 已细分的子场景映射

#### form

| 子场景 | 策略文件 |
|---|---|
| `login` | `content/strategies/page-types/form/login.js` |
| `register` | `content/strategies/page-types/form/register.js` |
| `search` | `content/strategies/page-types/form/search.js` |
| `survey` | `content/strategies/page-types/form/survey.js` |
| `default` | `content/strategies/page-types/form/default.js` |

#### feed

| 子场景 | 策略文件 |
|---|---|
| `bilibili-home` | `content/strategies/page-types/feed/bilibili-home.js` |
| `video-site-home` | `content/strategies/page-types/feed/video-site-home.js` |
| `generic-feed` | `content/strategies/page-types/feed/generic-feed.js` |

---

## 6. 当前各页面类型的注入策略

## 6.1 article

策略文件：
- `content/strategies/page-types/article.js`

当前策略：
- `strategyId`: `article-inline-summary`
- `placementMode`: `after-paragraph`
- `renderMode`: `card`
- `contentGoal`: `summary`

当前位置规则：
- 正文第二段后优先
- 其次为第一段后
- 再其次为正文标题后

---

## 6.2 feed

父级策略文件：
- `content/strategies/page-types/feed.js`

父级职责：
- 判断当前属于哪一种信息流子场景
- 再转发给对应子场景策略文件

当前已细分子场景：

### 6.2.1 bilibili-home

策略文件：
- `content/strategies/page-types/feed/bilibili-home.js`

适用场景：
- B站首页推荐流
- B站前部稳定锚点明显的内容流页面

策略特点：
- 优先页面前部稳定锚点
- 避免插入持续增长的视频流内部
- 更适合后续做 B站专项适配

### 6.2.2 video-site-home

策略文件：
- `content/strategies/page-types/feed/video-site-home.js`

适用场景：
- 视频站首页流
- 类似 YouTube / 抖音 的首页推荐结构

策略特点：
- 优先稳定顶部锚点
- 适合强调视觉首屏中的伪装插入

### 6.2.3 generic-feed

策略文件：
- `content/strategies/page-types/feed/generic-feed.js`

适用场景：
- 通用信息流
- 暂时没有站点专项规则的 feed 页

策略特点：
- 动态流时走稳定锚点
- 普通流时允许卡片之间插入

---

## 6.3 form

父级策略文件：
- `content/strategies/page-types/form.js`

父级职责：
- 判断当前属于哪一种表单子场景
- 再转发给对应子场景策略文件

当前已细分子场景：

### 6.3.1 login

策略文件：
- `content/strategies/page-types/form/login.js`

适用场景：
- 登录页
- 账号密码输入页

策略特点：
- 注入位置优先第一组认证字段之前
- 适合放在标题区和账号输入框之间

### 6.3.2 register

策略文件：
- `content/strategies/page-types/form/register.js`

适用场景：
- 注册页
- 创建账号页

策略特点：
- 优先第一组注册字段上方
- 适合后续细调用户名、密码、邮箱前的位置策略

### 6.3.3 search

策略文件：
- `content/strategies/page-types/form/search.js`

适用场景：
- 搜索页
- 搜索框主导页面

策略特点：
- 优先搜索输入框正上方
- 更适合简短型帮助提示

### 6.3.4 survey

策略文件：
- `content/strategies/page-types/form/survey.js`

适用场景：
- 问卷页
- 填写型表单页

策略特点：
- 优先第一道问题或第一组字段前
- 更适合表单说明或填写引导

### 6.3.5 default

策略文件：
- `content/strategies/page-types/form/default.js`

适用场景：
- 无法明确归类的通用表单页

策略特点：
- 仍然优先第一组表单字段上方
- 作为表单页统一兜底策略

---

## 6.4 product

策略文件：
- `content/strategies/page-types/product.js`

当前位置规则：
- 标题区后优先
- 价格区附近次之
- 再其次是详情模块开头

---

## 6.5 dashboard

策略文件：
- `content/strategies/page-types/dashboard.js`

当前位置规则：
- 主内容容器顶部优先

---

## 6.6 video

策略文件：
- `content/strategies/page-types/video.js`

当前位置规则：
- 播放器附近优先
- 标题区附近次之

---

## 6.7 generic

策略文件：
- `content/strategies/page-types/generic.js`

当前位置规则：
- 简单页面优先标题或首段附近
- 普通页面兜底到主内容容器顶部

---

## 7. 后续二次开发建议

### 7.1 如果你要改注册页

直接改：
- `content/strategies/page-types/form/register.js`

### 7.2 如果你要改登录页

直接改：
- `content/strategies/page-types/form/login.js`

### 7.3 如果你要改问卷页

直接改：
- `content/strategies/page-types/form/survey.js`

### 7.4 如果你要改 B站首页推荐流

直接改：
- `content/strategies/page-types/feed/bilibili-home.js`

### 7.5 如果你要改通用信息流

直接改：
- `content/strategies/page-types/feed/generic-feed.js`

---

## 8. 当前重构的意义

现在系统已经从“页面类型直接映射到单文件策略”进一步变成：

- 分类负责识别一级页面类型
- 一级页面类型负责识别子场景
- 子场景目录负责真正的页面特化逻辑
- 主流程只负责调度，不再承载具体页面特化实现

这样后续你做二次开发时，就可以真正做到：

- 只改某类页面
- 不影响其他页面
- 策略代码边界清晰

---

## 9. 当前最推荐的后续开发顺序

建议优先按这个顺序继续完善：

1. 先把 `form/register.js` 调到满意
2. 再调 `form/login.js` 和 `form/survey.js`
3. 然后重点细化 `feed/bilibili-home.js`
4. 再继续扩展其他 `feed` 子场景

原因是：

- 表单页现在已经具备了细分目录，最适合立刻开始专项调整
- 信息流页尤其是 B站首页，是第二个最需要做站点专项细化的方向
