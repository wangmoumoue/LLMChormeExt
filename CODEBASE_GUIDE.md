# LLaMb 项目二次开发阅读指南

这份文档不是面向最终用户的使用说明，而是面向准备继续维护、阅读源码、增加功能、修复问题和做二次开发的人。

如果你第一次接触这个项目，建议把它当成一个“浏览器中的 AI 助手系统”来看，而不是一个普通网页项目。它没有前端打包流程，没有后端服务端代码，核心运行在 Chrome 扩展环境里，由以下几部分协同完成：

- `content.js`：运行在网页里，负责侧边栏 UI 和页面上下文采集
- `background.js`：运行在扩展后台，负责调度、消息转发和 LLM 请求
- `popup.html/popup.js`：扩展图标弹窗，负责轻量管理入口
- `settings.html/settings.js`：完整设置页，负责连接、插件、全局配置
- `js/*.js`：底层能力模块，包括存储、聊天、LLM、插件和流式解析
- `plugins/*`：站点插件，给特定网站补充额外上下文

---

## 1. 先建立整体心智模型

先不要一上来就扎进某个大文件里。最容易看懂这个项目的方法，是先建立它的运行地图。

### 1.1 这个项目的本质

它是一个 Chrome Manifest V3 扩展，目标是在任意网页中打开一个 AI 聊天侧边栏，并把“当前网页上下文”一并发给大模型。

这里的“网页上下文”通常包括：

- 当前页面标题
- 当前页面 URL
- 用户当前选中的文本
- 页面抽取后的正文或可见文本
- 特定插件提取的附加信息，例如 YouTube 字幕

### 1.2 一次请求的完整路径

你可以把一次聊天请求理解成下面这条链路：

1. 用户在网页里打开侧边栏
2. `content.js` 创建 UI，并监听输入框发送消息
3. `content.js` 采集当前页面上下文
4. `content.js` 调用 `chrome.runtime.sendMessage(...)` 把消息发给 `background.js`
5. `background.js` 调用 `LLMManager`
6. `LLMManager` 读取当前激活连接，并选择对应 Provider
7. Provider 请求外部模型 API
8. 如果是流式返回，后台会持续把 chunk 转发给 `content.js`
9. `content.js` 实时刷新聊天 UI
10. `ChatManager` 持久化保存聊天记录

你后续读代码时，几乎所有逻辑都可以挂到这条链路的某一段上。

---

## 2. 推荐阅读顺序

这个项目文件不少，而且 `content.js` 很大。如果你直接从头看到尾，很容易失去方向。下面是更适合二次开发的阅读顺序。

### 第一轮：先看入口和边界

按这个顺序看：

1. [manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/manifest.json)
2. [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)
3. [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)

这一轮的目标不是看细节，而是回答三个问题：

- 哪些脚本会被加载
- 它们运行在哪个环境
- 它们之间怎么通信

### 第二轮：看底层模块

按这个顺序看：

1. [js/storage-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/storage-manager.js)
2. [js/chat-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/chat-manager.js)
3. [js/llm-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-manager.js)
4. [js/llm-providers.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-providers.js)
5. [js/stream-parser.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/stream-parser.js)

这一轮的目标是回答：

- 数据存在哪里
- 聊天怎么保存
- LLM 请求怎么发
- 不同模型接口怎么适配
- 流式响应怎么被解析

### 第三轮：看插件系统

按这个顺序看：

1. [js/plugin-base.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-base.js)
2. [js/plugin-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-manager.js)
3. [plugins/youtube-captions/manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/plugins/youtube-captions/manifest.json)
4. [plugins/youtube-captions/plugin.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/plugins/youtube-captions/plugin.js)

这一轮的目标是回答：

- 插件怎么被注册
- 插件怎么启用
- 插件怎么向聊天系统提供内容
- 新插件应该模仿哪个现有实现

### 第四轮：看用户界面层

按这个顺序看：

1. [popup.html](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/popup.html)
2. [popup.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/popup.js)
3. [settings.html](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.html)
4. [settings.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.js)
5. [sidebar.css](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/sidebar.css)
6. [llamb-ui.css](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/llamb-ui.css)

这一轮的目标是回答：

- 用户从哪里进入功能
- 设置页和弹窗分别承担什么角色
- 侧边栏和弹窗的样式分别由谁控制

---

## 3. 先看 manifest：它定义了整个扩展的世界

[manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/manifest.json) 是整个项目最重要的入口文件。

### 3.1 你要重点看什么

- `manifest_version`
- `permissions`
- `host_permissions`
- `content_scripts`
- `background`
- `action`
- `web_accessible_resources`

### 3.2 它在这个项目里起什么作用

#### `content_scripts`

这里定义了哪些脚本会注入到网页中。当前项目会把这些脚本注入所有页面：

- `js/plugin-base.js`
- `js/plugin-manager.js`
- `plugins/youtube-captions/plugin.js`
- `content.js`

这说明两件事：

- 插件基础设施和插件本体，是在网页环境中运行的
- 主侧边栏逻辑 `content.js` 同样运行在网页上下文

#### `background`

这里声明 `background.js` 是后台 Service Worker。

这意味着：

- 它不是常驻页面脚本
- 它负责跨页面的扩展后台逻辑
- 它更适合发 API 请求、管理全局状态、响应来自不同页面的消息

#### `web_accessible_resources`

这一块非常重要，因为 `content.js` 会在页面里动态加载一些脚本，例如：

- `js/storage-manager.js`
- `js/chat-manager.js`
- `js/llm-manager.js`
- `js/llm-providers.js`

如果你以后新增了要在页面环境中动态加载的脚本，但忘了把它加入 `web_accessible_resources`，脚本会加载失败。

#### `permissions`

这个项目目前用到的权限包括：

- `activeTab`
- `storage`
- `scripting`
- `contextMenus`

这些权限分别对应：

- 获取当前活动标签页
- 读写本地存储
- 注入脚本
- 创建右键菜单

---

## 4. 核心运行链路详解

这一节是整个文档最重要的部分。如果你能读懂这一节，后面看任何代码都会顺很多。

### 4.1 页面侧边栏是怎么出现的

负责文件：

- [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)
- [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)

流程大致如下：

1. 用户点击扩展图标，或者通过右键菜单触发
2. `background.js` 收到事件
3. `background.js` 向当前标签页发送 `toggleSidebar`
4. `content.js` 收到这个 action 后创建或切换侧边栏

你会在以下位置看到这些逻辑：

- `chrome.action.onClicked`：点击扩展图标
- `chrome.contextMenus.onClicked`：点击右键菜单
- `content.js` 里的 `toggleSidebar()`
- `content.js` 里的 `createSidebar()`

### 4.2 用户发消息时发生了什么

用户在侧边栏输入消息之后，逻辑会分成两半：

- 前半段在 `content.js`
- 后半段在 `background.js + LLMManager`

#### 前半段：`content.js`

`content.js` 负责：

- 获取用户输入
- 调用 `getPageContext()`
- 读取选中文本、页面正文、插件内容
- 把这些数据和消息一起发给后台

#### 后半段：`background.js`

`background.js` 在 `chrome.runtime.onMessage.addListener(...)` 中统一接收消息，然后根据 `request.action` 分发到对应处理函数。

用户发消息时会走到：

- `handleChatMessage(...)`

这个函数会：

1. 确保 `llmManager` 已初始化
2. 从请求里取出 `message`、`pageContext` 和 `options`
3. 调用 `llmManager.sendMessage(...)`
4. 如果是流式响应，就注册 `streamChunk` / `streamEnd` / `streamError` 监听
5. 把流式内容继续转发回当前页面

### 4.3 为什么 LLM 请求放在后台而不是 content script

这么设计的主要原因是职责分离和扩展架构上的合理性。

后台层更适合做这些事：

- 管理全局连接状态
- 发起统一 API 请求
- 做流式事件分发
- 为 popup / settings / content script 提供公共服务

从工程上看，`background.js` 更像“控制中心”，`content.js` 更像“前端视图层 + 页面采集层”。

### 4.4 流式响应是怎么工作的

负责文件：

- [js/llm-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-manager.js)
- [js/llm-providers.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-providers.js)
- [js/stream-parser.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/stream-parser.js)
- [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)
- [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)

执行过程如下：

1. `LLMManager.sendMessage(...)` 判断当前连接是否支持流式
2. 如果支持，就进入 `sendStreamingMessage(...)`
3. Provider 返回 `response.body`
4. `LLMManager` 从 `ReadableStream` 里不断 `read()`
5. 每个 chunk 交给 `StreamParser.parseChunk(...)`
6. 解析出内容片段后，`LLMManager.emit('streamChunk', ...)`
7. `background.js` 监听这些事件，并转发消息给页面
8. `content.js` 收到 `streamChunk` 和 `streamEnd` 后更新消息 UI

所以你以后如果遇到“流式内容不显示”的问题，排查顺序一般是：

1. Provider 是否真的返回了流
2. `StreamParser` 是否正确解析
3. `background.js` 是否正确转发
4. `content.js` 是否正确监听和渲染

---

## 5. 每个核心文件的作用

这一节按文件逐个解释，适合你在 IDE 里边看边对照。

### 5.1 根目录文件

#### [manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/manifest.json)

扩展声明文件。定义：

- 扩展权限
- 内容脚本注入规则
- 后台脚本
- 图标
- 可供页面访问的资源

这是所有开发工作的起点。

#### [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)

后台 Service Worker，是整个系统的调度中心。

主要职责：

- 安装和启动时初始化 `LLMManager`、`ChatManager`
- 创建右键菜单
- 响应 popup、settings、content script 发来的消息
- 处理聊天请求
- 管理连接列表读取和切换
- 返回聊天历史
- 转发流式输出
- 提供插件开关接口

你可以把它看作“后端网关”，只是这个后端运行在浏览器扩展里。

#### [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)

这是项目里最大的文件，也是前端交互最集中的地方。

主要职责：

- 防止重复注入
- 初始化 `ChatManager`、`StorageManager`、`PluginManager`
- 创建侧边栏 DOM
- 管理侧边栏显示/隐藏
- 支持浮动模式和贴边模式
- 记录并恢复侧边栏状态
- 渲染聊天消息
- 获取页面上下文
- 把消息发给后台
- 接收流式响应并实时显示
- 加载聊天历史
- 与插件系统交互

这个文件非常大，所以建议你按功能块看，而不是线性从头扫到尾。最值得先看的函数通常是：

- `initializeManagers()`
- `restoreSidebarState()`
- `createSidebar()`
- `toggleSidebar()`
- `getPageContext()`
- 消息监听部分

#### [popup.html](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/popup.html)

扩展图标点击后弹出的页面结构。

职责是承载：

- 侧边栏开关入口
- 连接快速管理
- 快捷动作执行入口
- 插件列表
- 设置入口

#### [popup.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/popup.js)

弹窗的交互逻辑。

主要职责：

- 初始化弹窗
- 获取并展示连接
- 切换当前激活连接
- 切换当前页面的侧边栏
- 读取快捷动作并执行
- 读取插件列表并在弹窗里展示状态
- 打开设置页面

如果你想给弹窗加一个新的快捷按钮，一般先改这个文件。

#### [settings.html](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.html)

完整设置页的 DOM 结构。这个页面更适合承载复杂表单和配置项。

#### [settings.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.js)

设置页逻辑。

主要职责：

- 读取和保存全局设置
- 管理连接表单
- 测试连接
- 导入导出设置
- 展示插件列表
- 启用和停用插件

如果你要新增某项全局设置，通常会改这里和 `StorageManager`。

#### [sidebar.css](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/sidebar.css)

侧边栏样式文件，专门服务于注入到网页中的聊天界面。

它会控制：

- 侧边栏布局
- 浮动窗口布局
- 消息样式
- 芯片样式
- 弹窗和交互区域样式

#### [llamb-ui.css](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/llamb-ui.css)

弹窗和设置页共用的 UI 样式系统。

#### [DESIGN_SYSTEM.md](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/DESIGN_SYSTEM.md)

记录了 UI 层设计规则和视觉约束，偏设计说明。

#### [PLUGIN_DEVELOPMENT.md](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/PLUGIN_DEVELOPMENT.md)

插件开发指导文档，适合你准备写新插件时参考。

### 5.2 `js/` 目录

#### [js/storage-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/storage-manager.js)

这是项目的数据中枢之一。只要是“设置、连接、状态、快捷动作、活动会话”之类的数据，基本都从这里进出。

它管理的核心数据包括：

- `llamb-settings`
- `llamb-sidebar-state`
- `llamb-active-chat`

内部重点能力：

- `getSettings()` / `saveSettings()`
- 连接 CRUD
- 全局设置更新
- 快捷动作 CRUD
- 侧边栏状态恢复
- 当前活动聊天状态保存

如果你新增了一个全局配置项，通常这里是必须改的。

#### [js/chat-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/chat-manager.js)

负责聊天记录生命周期。

内部重点能力：

- 创建聊天
- 生成聊天标题
- 加消息
- 读取历史
- 删除聊天
- 导出 Markdown
- 控制保留聊天数量

这个类让聊天历史不只是“UI 上显示一下”，而是成为可恢复、可归档的数据。

#### [js/llm-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-manager.js)

这是 AI 请求的核心编排器。

主要职责：

- 从 `StorageManager` 取当前激活连接
- 构造消息数组
- 生成系统上下文
- 选择 Provider
- 发起流式或非流式请求
- 在不同连接之间做 fallback
- 发出事件给后台层

最关键的函数：

- `sendMessage(...)`
- `sendStreamingMessage(...)`
- `sendSingleMessage(...)`
- `buildMessageArray(...)`
- `formatPageContext(...)`
- `sendMessageWithFallback(...)`

如果你想改变“页面上下文是怎么拼进 Prompt 的”，优先看 `formatPageContext(...)`。

#### [js/llm-providers.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-providers.js)

这是模型接口适配层。

当前包含：

- `BaseProvider`
- `OpenAIProvider`
- `OpenAICompatibleProvider`
- `AnthropicProvider`

这个文件的职责是把统一的连接配置和消息数组，翻译成不同模型 API 所需的 HTTP 请求格式。

如果你以后要接：

- Gemini
- DeepSeek
- Claude 新接口
- 本地模型服务

一般应该从这里扩展，而不是把接口判断散落到 `LLMManager` 里。

#### [js/stream-parser.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/stream-parser.js)

这个模块负责把“原始流式文本”解析成“UI 可以消费的结构化数据”。

它做的事情包括：

- 解析 OpenAI 风格 SSE
- 识别 `[DONE]`
- 提取正常内容片段
- 解析 `<reasoning>`、`<thinking>` 等特殊块

如果你要支持新的流格式，或者想把更多“思考块”展示出来，这个文件非常关键。

#### [js/plugin-base.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-base.js)

所有插件的父类。

它定义了插件必须实现的抽象方法：

- `shouldRunOnCurrentPage()`
- `getContent()`
- `getContextChipData()`

也提供了大量帮助方法：

- 域名匹配
- URL 匹配
- 等待 DOM 元素
- 安全执行异步操作
- 添加和移除上下文 chip

如果你要写新插件，先把这个类看懂。

#### [js/plugin-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-manager.js)

插件调度器。

职责包括：

- 注册内置插件
- 读取插件开关状态
- 加载已启用插件
- 创建插件 API
- 在页面变化时调用插件生命周期
- 把插件上下文 chip 显示到页面
- 从插件读取内容并交给聊天系统

要注意一点：由于 Manifest V3 的 CSP 限制，插件脚本并不是随便动态执行的，通常需要预先在 `manifest.json` 里声明。

#### [js/debug-logger.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/debug-logger.js)

统一日志控制器。

它会读取用户设置里的 `debugLogging`，决定普通日志是否输出。错误日志默认总是输出。

这个模块的意义是：

- 调试时可以开详细日志
- 平时不会污染控制台

### 5.3 `plugins/` 目录

#### [plugins/youtube-captions/manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/plugins/youtube-captions/manifest.json)

描述插件的元信息：

- 插件 ID
- 名称
- 描述
- 匹配页面
- 权限
- 默认设置

#### [plugins/youtube-captions/plugin.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/plugins/youtube-captions/plugin.js)

这是当前项目最重要的插件示例。

它展示了插件如何：

- 判断当前页面是否应该运行
- 从 YouTube 页面提取视频字幕
- 通过后台或页面方式获取数据
- 暴露上下文 chip
- 给聊天系统提供额外内容

如果你要做新的站点插件，最值得仿照的就是它。

---

## 6. content.js 应该怎么读

`content.js` 非常长，但你完全没必要一次性全读完。建议按下面的分块方式阅读。

### 6.1 初始化部分

你首先要看：

- 重复注入防护
- 调试开关读取
- 管理器初始化
- 状态变量定义

你要理解的是：

- 页面里有哪些全局状态
- 哪些对象是延迟初始化的
- 哪些数据会在本页面生命周期内一直存在

### 6.2 管理器初始化

重点看：

- `loadRequiredScripts()`
- `initializeManagers()`

要点：

- `StorageManager` 和 `ChatManager` 可能由页面动态加载
- `PluginManager` 依赖 manifest 预加载的插件脚本
- `content.js` 需要先知道当前 `tabId`，才能恢复状态

### 6.3 UI 创建与切换

重点看：

- `createSidebar()`
- `toggleSidebar()`
- 浮动模式切换逻辑
- 拖拽和缩放逻辑

你在这一部分要形成的理解是：

- UI 并不是预先写在 HTML 里，而是运行时插入页面的
- 侧边栏既可以贴边，也可以浮动
- 状态会持久化，下次恢复

### 6.4 消息渲染与聊天历史

重点看：

- `addMessageToUI(...)`
- `loadChat(...)`
- `createNewChat(...)`
- 历史记录下拉相关逻辑

这一块决定了聊天如何在页面里显示，以及一个聊天如何被恢复。

### 6.5 页面上下文采集

最关键的是：

- `getPageContext()`

这是二次开发最常改的部分之一。

当前它会整理：

- 页面标题
- 页面 URL
- 选中文本
- 页面抽取结果
- 插件附加内容

如果你以后要增强：

- PDF 解析
- 文章正文提纯
- 代码块提取
- 表格提取

通常都应该从这里切入。

### 6.6 后台通信和流式处理

重点看：

- 向后台发送 `sendChatMessage`
- 接收 `streamChunk`
- 接收 `streamEnd`
- 接收 `streamError`

这一块是页面层和后台层的桥梁。

---

## 7. background.js 应该怎么读

`background.js` 是典型的“消息中心”写法，最适合从顶层入口往下看。

### 7.1 安装与启动

重点看：

- `chrome.runtime.onInstalled.addListener(...)`
- `chrome.runtime.onStartup.addListener(...)`

这一部分负责：

- 初始化 `LLMManager`
- 初始化 `ChatManager`
- 创建右键菜单
- 迁移旧版设置

### 7.2 用户入口事件

重点看：

- `chrome.contextMenus.onClicked`
- `chrome.action.onClicked`

它们决定：

- 用户点击图标时做什么
- 用户点右键菜单时做什么

### 7.3 消息路由

最关键的是：

- `chrome.runtime.onMessage.addListener(...)`

这个 switch 是整个扩展后台能力的总入口。

你可以把它当成一个“本地 API 路由表”。目前主要 action 包括：

- `getPageContext`
- `sendChatMessage`
- `getLLMConnections`
- `setActiveConnection`
- `testConnection`
- `openSettings`
- `getCurrentTab`
- `getChatHistory`
- `loadChat`
- `deleteChat`
- `exportChat`
- `getAvailablePlugins`
- `enablePlugin`
- `disablePlugin`

以后你要加新的后台能力，最常见的做法就是：

1. 在这里加一个新的 `action`
2. 写一个对应处理函数
3. 在 content/popup/settings 某一端发消息调用它

### 7.4 聊天请求处理

重点看：

- `handleChatMessage(...)`

这是聊天主流程的后台入口，最值得深入理解。

看这个函数时，重点关注：

- 请求参数结构
- `llmManager.sendMessage(...)`
- 流式监听器注册
- 如何把流式结果回发到页面

---

## 8. 数据是怎么存的

这个项目没有数据库，所有持久化都依赖 Chrome 扩展存储。

### 8.1 `chrome.storage.local`

用于保存长期数据，例如：

- 连接配置
- 全局设置
- 快捷动作
- 聊天历史
- 插件设置

### 8.2 `chrome.storage.session`

用于保存更偏会话态的数据，例如：

- 某个标签页的侧边栏显示状态
- 当前激活聊天

### 8.3 本地 `localStorage`

在 `content.js` 中额外用于保存一些页面层偏好，例如：

- 浮动窗口模式偏好
- 浮动窗口位置
- 浮动窗口尺寸

### 8.4 你在二次开发时要注意什么

- 新增全局配置，优先放进 `StorageManager.defaultSettings`
- 新增会话态数据，要分清应该放 `local` 还是 `session`
- 页面层布局偏好可以放 `localStorage`，但业务数据不建议乱放

---

## 9. 插件系统是怎么运作的

插件系统是这个项目最适合扩展的部分之一。

### 9.1 插件的本质

插件本质上是“针对特定网站的上下文增强器”。

它不是通用 UI 组件，也不是后台服务。它的主要任务是：

- 判断自己是否应该在当前页面启用
- 从当前网站提取额外内容
- 通过 chip 形式暴露给用户
- 在聊天时把内容作为额外上下文传给模型

### 9.2 插件生命周期

以 `LlambPluginBase` 为基准，插件生命周期包括：

- `onInit()`
- `onActivate()`
- `onDeactivate()`
- `onPageChange()`

### 9.3 插件如何被管理器调度

`PluginManager` 会：

1. 注册内置插件
2. 读取哪些插件已启用
3. 加载插件实例
4. 在页面变化时调用 `onPageChange()`
5. 让插件往 UI 中加入 context chip
6. 在聊天时从插件读取内容

### 9.4 你新增一个插件时通常要改哪里

最少会涉及：

1. 新建 `plugins/your-plugin/manifest.json`
2. 新建 `plugins/your-plugin/plugin.js`
3. 在 [manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/manifest.json) 中加入脚本或资源声明
4. 在 [js/plugin-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-manager.js) 的 `discoverPlugins()` 中注册它

---

## 10. 如果你想改某个功能，应该从哪里下手

这一节是二次开发最实用的部分。

### 10.1 想改侧边栏 UI

先看：

- [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)
- [sidebar.css](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/sidebar.css)

通常会改：

- `createSidebar()`
- 消息渲染函数
- 样式类名和布局样式

### 10.2 想改页面上下文提取策略

先看：

- [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)
- [js/llm-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-manager.js)

通常会改：

- `getPageContext()`
- `extractPageContent()` 或相关提取逻辑
- `formatPageContext(...)`

### 10.3 想支持新的大模型服务

先看：

- [js/llm-providers.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-providers.js)
- [js/llm-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-manager.js)
- [settings.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.js)

通常会做：

1. 新增一个 Provider 类
2. 在 `LLMProviders` 注册它
3. 让设置页支持该连接类型
4. 适配连接测试逻辑

### 10.4 想修改聊天保存逻辑

先看：

- [js/chat-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/chat-manager.js)
- [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)
- [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)

### 10.5 想增加一个新设置项

通常需要同时改：

- [js/storage-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/storage-manager.js)
- [settings.html](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.html)
- [settings.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.js)

有时也要改：

- [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)
- [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)

### 10.6 想增加一个站点插件

先看：

- [js/plugin-base.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-base.js)
- [js/plugin-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-manager.js)
- [plugins/youtube-captions/plugin.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/plugins/youtube-captions/plugin.js)

---

## 11. 调试时应该看哪里

### 11.1 页面层问题

比如：

- 侧边栏不显示
- 页面上下文没采到
- 消息 UI 不更新

优先看：

- 网页 DevTools Console
- `content.js`
- `sidebar.css`

### 11.2 后台层问题

比如：

- API 请求失败
- 消息没有回传
- 聊天请求卡住

优先看：

- 扩展的 Service Worker 控制台
- `background.js`
- `js/llm-manager.js`
- `js/llm-providers.js`

### 11.3 设置页或弹窗问题

比如：

- 连接不显示
- 插件列表不显示
- 设置保存失败

优先看：

- popup / settings 自己的 DevTools
- `popup.js`
- `settings.js`
- `StorageManager`

### 11.4 日志系统

项目里有 [js/debug-logger.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/debug-logger.js)，它会根据设置项控制普通调试日志输出。

如果你调试时想看到更多信息，可以在设置中打开 `debugLogging`。

---

## 12. 二次开发时最容易踩的坑

### 12.1 搞混运行环境

这个项目最容易出错的地方之一，就是忘记某段代码运行在哪个上下文。

你要时刻分清：

- `content.js` 在网页环境
- `background.js` 在扩展后台
- `popup.js` 在弹窗页面
- `settings.js` 在设置页面

不要假设某个对象在所有地方都可用。

### 12.2 忘记更新 manifest

新增脚本、插件或资源时，常见问题不是代码写错，而是：

- 没有在 `manifest.json` 里声明
- 没有加入 `web_accessible_resources`
- 没有加入 `content_scripts`

### 12.3 直接在大文件里乱改

尤其是 `content.js`，很长，也承担了很多职责。

更好的做法是：

- 先定位你要改的是 UI、状态、上下文还是消息流
- 再只动对应功能块
- 能下沉到 `js/` 模块的逻辑尽量不要继续堆在 `content.js`

### 12.4 新增设置但没接通全链路

很多功能不是改一个文件就完了。比如新设置项一般至少涉及：

- 默认值
- 设置页 UI
- 保存逻辑
- 读取逻辑
- 功能实际消费逻辑

### 12.5 流式响应问题排查不分层

遇到流式异常时，建议按这条路径排查：

1. Provider 拿到的原始响应对不对
2. `StreamParser` 解析是否正常
3. `background.js` 是否监听并转发
4. `content.js` 是否接收并更新 UI

---

## 13. 建议你做的第一批重构

如果你准备长期维护这个项目，下面这些方向会很值。

### 13.1 拆分 `content.js`

建议按职责拆成几个模块，例如：

- `sidebar-ui`
- `chat-ui`
- `page-context`
- `history-panel`
- `floating-window`
- `message-bridge`

### 13.2 统一消息协议

现在消息 action 已经比较多了，可以进一步整理成更清晰的协议层，避免字符串分散。

### 13.3 给存储结构加版本号

后续功能变多后，设置结构变化会更多。可以考虑在存储数据中加入 schema version，方便迁移。

### 13.4 把 Provider 配置和能力声明做得更标准

这样未来支持更多模型服务会轻松很多。

### 13.5 增加更明确的页面内容抽取策略

当前页面内容抽取是可用的，但如果以后想做更高质量的网页理解，建议把正文提取算法单独模块化。

---

## 14. 给新开发者的最短上手路线

如果你只想先尽快上手，再慢慢深入，可以按下面做：

1. 先看 [manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/manifest.json)，搞清楚谁会被加载
2. 看 [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)，搞清楚消息路由
3. 看 [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js) 里的 `createSidebar()`、`toggleSidebar()`、`getPageContext()`
4. 看 [js/storage-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/storage-manager.js)，搞清楚设置和连接怎么存
5. 看 [js/llm-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-manager.js)，搞清楚消息怎么发给模型
6. 看 [plugins/youtube-captions/plugin.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/plugins/youtube-captions/plugin.js)，搞清楚插件怎么写

做到这一步，你基本就能开始改功能了。

---

## 15. 结论：你应该怎样理解整个项目

最适合的理解方式是：

- `content.js` 是网页中的前端壳和上下文采集器
- `background.js` 是扩展内的服务调度中心
- `js/` 是系统能力层
- `popup/settings` 是管理界面
- `plugins/` 是面向站点的可扩展增强层

如果你后面做二次开发，建议你每次改功能前都先问自己三件事：

1. 这个功能属于页面层、后台层、配置层还是插件层
2. 它的数据应该存在哪里
3. 它是否需要跨上下文通信

这三个问题一旦想清楚，改起来会顺很多。
