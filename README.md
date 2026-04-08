# LLaMb Page Analyzer

`LLaMb Page Analyzer` 是一个基于 Chrome Manifest V3 的网页分析扩展。

它的目标不是打开一个独立面板，而是：

- 读取当前网页的上下文
- 将上下文发送到本地 mock 流程或后端 LLM
- 在网页正文中插入一块尽量贴近原站风格的“页面简介”内容

当前版本的重点是“自然融入网页本身”：

- 自动识别页面结构
- 自动选择较自然的插入位置
- 自动避开顶部悬浮导航
- 自动识别无限滚动 / 信息流页面
- 自动采样宿主页面的字体、颜色、边框、圆角、阴影
- 自动使用当前网站 `favicon` 作为简介标题前图标
- 最终只显示一张中文简介卡，不再输出多张分析卡片

## 当前项目能做什么

### 1. 分析当前网页

扩展会从当前标签页提取这些信息：

- 页面 URL
- 页面标题
- 用户当前选中的文本
- 主内容文本
- 页面结构锚点
- 页面样式信号
- 页面行为信号，例如是否是动态信息流页面

这些信息由 [content.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js) 收集。

### 2. 在网页中插入原生感更强的简介模块

扩展不会弹出一个独立聊天窗口，而是直接修改真实网页 DOM，将一块简介内容插入到页面流中。

当前插入块具备这些特征：

- 真实 DOM 节点插入，不是截图或浮层假 UI
- 使用网页自己的颜色、字体和板块风格
- 使用网站 `favicon` 作为标题前图标
- 默认只显示一张“页面简介”
- 内容为中文简短介绍

### 3. 自动决定更自然的插入位置

当前项目不再只依赖固定的“顶部插入”，而是加入了本地布局判断：

- 识别顶部 `fixed/sticky` 导航，避免插入后被导航遮住
- 避免插到页面视觉最底部
- 对动态信息流页面优先尝试中部白区或稳定锚点
- 对普通页面优先选择正文流中更自然的位置

这部分逻辑同样位于 [content.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)。

### 4. 支持本地 mock 与后端 LLM 两种模式

项目支持两种分析来源：

- `mock` 模式：本地直接生成简介内容，便于快速调试
- `backend` 模式：将页面上下文发往后端，再由后端调用 LLM 返回结果

后端接口由 [background.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js) 调用，示例服务在 [backend-example/server.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/server.js)。

## 项目当前的工作流

整个流程可以概括为：

1. 用户点击扩展弹窗中的 `Analyze Current Page`
2. [background.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js) 确保内容脚本已经注入
3. [content.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js) 收集页面上下文与页面结构信号
4. `background.js` 根据设置选择：
   - 本地 `mock`
   - 后端接口
5. 如果使用后端：
   - 扩展将 `pageContext` 发送到你的后端
   - 后端再调用 LLM
6. 后端返回结构化结果后，前端会进一步收缩成一张“页面简介”
7. [content.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js) 根据页面布局和样式将其插入网页中

## 当前项目结构

```text
LLaMbChromeExt/
|-- manifest.json
|-- background.js
|-- content.js
|-- sidebar.css
|-- popup.html
|-- popup.js
|-- settings.html
|-- settings.js
|-- BACKEND_API.md
|-- CODEBASE_GUIDE.md
|-- DESIGN_SYSTEM.md
|-- backend-example/
|   |-- server.js
|   |-- llmClient.js
|   |-- promptBuilder.js
|   |-- responseValidator.js
|   `-- README.md
|-- js/
|   `-- storage-manager.js
|-- icons/
`-- plugins/
```

## 关键文件说明

### [manifest.json](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/manifest.json)

扩展入口配置文件。

当前主要声明了：

- 权限：`activeTab`、`storage`、`scripting`、`contextMenus`、`tabs`
- 内容脚本：`content.js`
- 注入样式：`sidebar.css`
- 后台 Service Worker：`background.js`
- 扩展图标与弹窗

### [background.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)

后台调度中心。

负责：

- 创建右键菜单
- 响应弹窗操作
- 注入内容脚本和样式
- 从页面拿 `pageContext`
- 请求 mock 或后端分析
- 统一把分析结果收敛为一张中文简介卡
- 将结果回传给页面进行渲染

### [content.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)

当前项目最核心的文件。

负责：

- 提取页面内容
- 识别页面是否为动态 feed / 无限滚动页面
- 识别页面顶部悬浮导航
- 识别更自然的中段插入位置
- 采样宿主页面样式
- 选择和插入真实 DOM
- 保持插入节点跟随占位符，避免被宿主页脚本挪走
- 获取网站 favicon 并展示在简介标题旁

### [sidebar.css](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/sidebar.css)

虽然文件名还是 `sidebar.css`，但当前用途已经不是旧侧边栏样式，而是页面内简介模块的样式定义。

它现在负责：

- 让插入块尽量贴近宿主页样式
- 保持只有一个外层框
- 控制 favicon、标题、正文排版
- 维持较弱侵入感的视觉表现

### [popup.html](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/popup.html) / [popup.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/popup.js)

扩展图标对应的弹窗入口。

当前功能很简单：

- 分析当前页面
- 打开设置页

### [settings.html](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.html) / [settings.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.js)

设置页用于管理全局配置。

当前主要配置项有：

- `Backend Analysis Endpoint`
- `Backend Auth Token`
- `Use Mock Analysis`

### [js/storage-manager.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/storage-manager.js)

用于读取和写入扩展设置，底层存储在 `chrome.storage.local`。

## 页面插入策略

当前项目的插入策略已经不是“盲目插顶部”，而是混合了几类本地判断：

### 1. 顶部导航避让

如果页面顶部存在可见的 `fixed` / `sticky` 导航，扩展会：

- 估算这层覆盖区的高度
- 避开这部分区域
- 调整最终滚动定位，防止简介被导航压住

### 2. 动态信息流识别

如果页面表现得像推荐流、视频流、瀑布流，扩展会：

- 标记为 `dynamic-feed`
- 避开不断增长的 feed 容器
- 尝试把内容放到更自然的中间白区或稳定锚点附近

### 3. 中间白区插入

在适合的页面中，扩展会优先寻找：

- 大块内容之后的自然空隙
- 中部白色留白区域
- 不容易被宿主页遮挡的位置

### 4. 占位符锁定

为了防止宿主页在滚动中重排 DOM 后把插入块“挤走”，当前实现使用了占位符机制：

- 首次插入时先放一个 slot
- 真正的内容始终跟着这个 slot
- 如果宿主页脚本挪动节点，扩展会尝试把内容拉回 slot 后面

## 页面风格融合策略

当前版本已经做了这些“仿站感”处理：

- 读取宿主页面的字体
- 读取正文和标题颜色
- 读取按钮或链接的强调色
- 读取页面板块的背景色
- 读取边框颜色
- 读取圆角和阴影
- 使用网站 favicon 作为标题图标

因此它不是完全使用固定设计系统，而是尽量贴近当前页面板块。

## 后端模式

如果关闭 `Use Mock Analysis`，扩展会调用后端接口。

请求入口格式见：

- [BACKEND_API.md](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/BACKEND_API.md)

示例后端位于：

- [backend-example/server.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/server.js)
- [backend-example/llmClient.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/llmClient.js)
- [backend-example/promptBuilder.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/promptBuilder.js)
- [backend-example/responseValidator.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/responseValidator.js)

当前后端示例支持：

- OpenAI 兼容接口
- 严格 JSON schema 返回
- 页面结构与样式信号输入
- 单张中文简介卡输出

## 如何运行

### 方式一：直接使用 mock 模式

适合先看注入效果。

1. 打开 Chrome
2. 进入 `chrome://extensions/`
3. 打开右上角“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择当前项目目录
6. 打开扩展设置页
7. 勾选 `Use Mock Analysis`
8. 打开任意网页
9. 点击扩展弹窗里的 `Analyze Current Page`

### 方式二：连接本地后端

1. 进入 [backend-example](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example)
2. 安装依赖并配置 `.env`
3. 启动本地后端
4. 在扩展设置页填写：
   - `Backend Analysis Endpoint`
   - `Backend Auth Token`（如有）
5. 关闭 `Use Mock Analysis`
6. 打开网页并执行分析

## 当前设置项

目前从代码可见的全局设置只有三项：

- `backendEndpoint`
- `backendAuthToken`
- `useMockAnalysis`

默认值定义在 [background.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js) 与 [js/storage-manager.js](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/storage-manager.js)。

## 当前项目的真实边界

这个 README 也明确说明当前项目“已经能做什么”和“还不能做什么”。

### 已经做到的

- 修改真实网页 DOM
- 插入真实文本与属性
- 改变页面中的真实布局位置
- 根据页面视觉风格做一定程度的融合
- 使用网站 favicon 增强原生感
- 自动识别部分动态信息流页面
- 避让顶部悬浮导航

### 还没有做到的

- 不能直接访问浏览器地址栏 UI
- 不能直接读取浏览器工具栏图标
- 不能保证对所有网站都完美融入
- 还没有为每个站点做专门适配
- 还没有把宿主页现成组件完整克隆成自己的模块

## 适合继续演进的方向

如果你要继续把项目做成“更像页面原生模块”的研究型原型，接下来比较值得做的是：

- 站点级适配规则，例如 B 站、学校首页、新闻站
- 更强的中部白区检测
- 识别双栏布局与轮播区后的自然插槽
- 更细的 favicon 选择规则，例如优先 16x16 / 32x32
- 复用宿主页已有胶囊标签、按钮和小图形组件
- 更稳的动态 DOM 重排恢复逻辑

## 开发提示

- 修改扩展代码后，需要回到 `chrome://extensions/` 点击刷新
- 页面侧逻辑请在网页 DevTools 中调试
- 后台逻辑请在扩展 Service Worker 面板中调试
- 如果页面样式没有更新，通常需要刷新目标网页

## 相关文档

- [BACKEND_API.md](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/BACKEND_API.md)
- [backend-example/README.md](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/README.md)
- [CODEBASE_GUIDE.md](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/CODEBASE_GUIDE.md)
- [DESIGN_SYSTEM.md](/c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/DESIGN_SYSTEM.md)
