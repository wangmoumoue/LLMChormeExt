# LLaMb Chrome Extension

`LLaMb Chrome Extension` 是一个基于 Chrome Manifest V3 的浏览器扩展，用来在任意网页侧边打开 AI 对话面板，并把当前页面的标题、URL、选中文本、页面内容以及插件提取到的附加信息一起发给大模型。

这个项目的核心目标不是做一个独立网页应用，而是把 AI 助手直接嵌入到浏览过程里，让你在阅读网页、看视频、查资料时，随时结合当前页面上下文进行提问、总结、解释和分析。

## 项目能做什么

- 在任意网页注入聊天侧边栏
- 自动采集当前网页上下文
- 支持选中文本后直接结合选区提问
- 支持多个 LLM 连接配置，并可切换当前激活模型
- 支持流式输出
- 保存聊天历史，并按会话恢复
- 支持快捷动作，快速发起“总结页面”“解释选中文本”等固定提示
- 支持插件机制，为特定网站提取额外内容
- 当前内置 `YouTube Captions` 插件，可提取 YouTube 视频字幕作为上下文

## 如何运行

这个项目是原生 Chrome 扩展项目，没有 `npm install`、没有打包脚本、也没有前端构建流程。运行方式就是直接以“开发者模式”加载源码目录。

### 运行步骤

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角的“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前项目根目录，也就是包含 [manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/manifest.json) 的目录
5. 加载成功后，浏览器工具栏会出现扩展图标

### 首次使用前要做的事

1. 点击扩展图标，打开弹窗界面
2. 进入设置页，添加至少一个 LLM 连接
3. 填写模型接口地址、模型名和 API Key
4. 将某个连接设为激活状态
5. 返回任意网页，点击扩展图标或右键菜单，打开侧边栏开始聊天

## 如何使用

### 1. 打开侧边栏

有几种入口：

- 点击浏览器工具栏中的扩展图标
- 使用右键菜单中的 `Toggle Chat Sidebar`
- 由弹窗中的按钮触发

侧边栏支持两种显示方式：

- 贴边侧栏模式
- 浮动窗口模式

浮动窗口的位置和尺寸会被记录，下次打开时会恢复。

### 2. 结合当前网页聊天

在网页中打开侧边栏后，发送消息时扩展会自动整理当前页面信息，通常包括：

- 页面标题
- 页面 URL
- 当前选中文本
- 页面提取出的正文内容
- 插件提取到的附加内容，例如 YouTube 字幕

这些内容会被拼成系统上下文，再和你的问题一起发送给当前激活的 LLM。

### 3. 使用快捷动作

项目内置了一组快捷动作，例如：

- 总结当前页面
- 解释当前选中文本
- 概述页面主题
- 提炼关键信息

快捷动作本质上是带变量占位符的 Prompt 模板，会自动填入页面标题、URL、正文和选区内容，然后直接把请求发到侧边栏里。

### 4. 管理连接

设置页支持：

- 新增连接
- 编辑连接
- 删除连接
- 测试连接
- 设为当前激活连接
- 配置是否启用流式输出、推理能力等特性

连接信息保存在本地 `chrome.storage.local` 中。

### 5. 管理插件

目前项目内置一个插件：

- `YouTube Captions`

启用后，当你访问 YouTube 视频页面时，插件会尝试提取字幕内容，并把它作为额外上下文提供给聊天系统。这样你可以直接基于视频字幕提问、总结和分析。

## 这个项目是怎么运作的

整个扩展可以理解成 4 层：

1. 页面层：采集上下文并渲染聊天 UI
2. 后台层：统一处理消息、管理 LLM 请求、转发流式响应
3. 配置层：管理连接、设置、快捷动作和会话数据
4. 插件层：为特定网站补充额外内容

### 页面层：`content.js`

[content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js) 是注入到网页中的主内容脚本，负责：

- 创建和销毁侧边栏 UI
- 管理侧边栏显示状态
- 支持浮动窗口拖拽和缩放
- 读取用户选区和页面内容
- 加载聊天历史并渲染消息
- 接收后台返回的流式内容并实时更新界面
- 协调插件，把插件提取的内容加入页面上下文

当用户在侧边栏里发送消息时，`content.js` 会先调用本地的页面上下文提取逻辑，再通过 `chrome.runtime.sendMessage` 把消息发给后台。

### 后台层：`background.js`

[background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js) 是扩展的 Service Worker，负责：

- 在安装和启动时初始化管理器
- 创建右键菜单
- 处理来自内容脚本、弹窗和设置页的消息
- 管理和调用 LLM
- 把流式输出按块转发回页面
- 提供聊天历史、连接列表、插件列表等后台能力

你可以把它理解成整个扩展的调度中心。

### 配置与数据层：`js/`

`js/` 目录下是扩展的核心逻辑模块。

#### [js/storage-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/storage-manager.js)

负责统一管理设置数据，包括：

- LLM 连接
- 当前激活连接
- 全局设置
- 快捷动作
- 侧边栏显示状态
- 当前激活会话

#### [js/chat-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/chat-manager.js)

负责聊天持久化，包括：

- 创建会话
- 保存消息
- 维护聊天标题
- 查询历史记录
- 删除会话
- 导出 Markdown

#### [js/llm-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-manager.js)

这是 LLM 调度核心，负责：

- 获取当前激活连接
- 构造消息数组
- 把页面上下文包装成系统提示
- 调用具体 Provider
- 处理流式和非流式响应
- 在多个连接之间做失败回退

#### [js/llm-providers.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-providers.js)

负责适配不同模型服务接口。当前代码主要覆盖：

- OpenAI
- OpenAI Compatible
- Anthropic

每个 Provider 会根据不同平台的 API 规范组装请求。

#### [js/stream-parser.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/stream-parser.js)

负责解析流式返回的数据块，把 SSE 或完整响应整理成可用于 UI 渲染的内容片段。

#### [js/plugin-base.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-base.js)

定义插件统一接口和公共能力，是所有插件的基类。

#### [js/plugin-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/plugin-manager.js)

负责：

- 注册插件
- 启用或停用插件
- 给插件分配受控 API
- 在页面变化时通知插件
- 从插件取回内容并作为上下文注入聊天

### 弹窗层：`popup.html` / `popup.js`

[popup.html](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/popup.html) 和 [popup.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/popup.js) 是点击扩展图标后看到的界面，主要承担轻量操作入口：

- 切换侧边栏
- 查看和切换连接
- 执行快捷动作
- 查看插件状态
- 跳转到设置页

适合日常快速使用。

### 设置页：`settings.html` / `settings.js`

[settings.html](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.html) 和 [settings.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.js) 是完整配置页，主要用于：

- 管理 LLM 连接
- 编辑全局设置
- 开关流式输出
- 导入和导出设置
- 管理插件启用状态

适合做完整配置和维护。

### 插件层：`plugins/`

当前插件目录里已有一个内置插件：

- [plugins/youtube-captions/plugin.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/plugins/youtube-captions/plugin.js)
- [plugins/youtube-captions/manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/plugins/youtube-captions/manifest.json)

它的作用是在 YouTube 视频页中提取字幕，并把结果暴露给侧边栏作为额外上下文。

## 一次完整请求的执行流程

下面是一条消息从输入到返回的大致路径：

1. 用户在网页中打开侧边栏并输入问题
2. [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js) 提取页面标题、URL、选区、页面正文和插件内容
3. 内容脚本把消息发给 [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)
4. 后台调用 [js/llm-manager.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/js/llm-manager.js)
5. `LLMManager` 根据当前激活连接选择对应 Provider
6. Provider 请求外部模型 API
7. 如果是流式响应，后台会把每个数据块持续转发回内容脚本
8. 内容脚本实时更新侧边栏消息 UI
9. 聊天记录由 `ChatManager` 持久化保存

## 项目结构

```text
LLaMbChromeExt/
+-- manifest.json               # Chrome 扩展入口配置
+-- background.js              # 后台 Service Worker
+-- content.js                 # 页面侧边栏与上下文采集主逻辑
+-- popup.html                 # 扩展弹窗页面
+-- popup.js                   # 弹窗交互逻辑
+-- settings.html              # 设置页面
+-- settings.js                # 设置页逻辑
+-- sidebar.css                # 页面侧边栏样式
+-- llamb-ui.css               # popup / settings 通用 UI 样式
+-- js/
    +-- storage-manager.js     # 设置、连接、快捷动作、状态存储
    +-- chat-manager.js        # 聊天历史管理
    +-- llm-manager.js         # LLM 请求编排
    +-- llm-providers.js       # 多 Provider 适配
    +-- stream-parser.js       # 流式结果解析
    +-- plugin-base.js         # 插件基类
    +-- plugin-manager.js      # 插件管理器
    +-- debug-logger.js        # 调试日志控制
+-- plugins/
    +-- youtube-captions/
        +-- manifest.json      # 插件元信息
        +-- plugin.js          # YouTube 字幕提取插件
+-- icons/                     # 扩展图标资源
+-- DESIGN_SYSTEM.md           # 界面设计说明
+-- PLUGIN_DEVELOPMENT.md      # 插件开发文档
```

## 支持的配置与能力

### 连接配置

连接对象通常包含：

- 连接名称
- Provider 类型
- Endpoint
- API Key
- 模型名
- 是否启用
- 优先级
- 是否支持流式输出

### 全局设置

当前代码中可见的全局设置包括：

- 主题
- 自动采集上下文
- 流式输出开关
- 是否展示 thinking blocks
- 最大 token 数
- temperature
- 调试日志开关

## 适合继续扩展的方向

这个项目已经具备继续演进的基础，比较容易扩展的方向有：

- 增加更多模型 Provider
- 增加更多站点插件
- 改进页面正文抽取质量
- 增强快捷动作模板系统
- 完善聊天导出与导入
- 为插件增加更完整的设置界面

## 开发提示

- 修改源码后，需要回到 `chrome://extensions/` 点击刷新扩展
- 内容脚本调试看网页 DevTools
- 后台逻辑调试看扩展的 Service Worker 控制台
- Popup 调试可以右键扩展弹窗进行检查
- 设置页就是普通扩展页面，可直接打开 DevTools

## 备注

- 本项目当前是本地配置模式，敏感信息保存在浏览器扩展存储中
- 连接测试逻辑默认会请求你配置的接口地址，确保接口支持对应 API 格式
- 插件加载方式受 Manifest V3 CSP 限制，新插件需要在 [manifest.json](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/manifest.json) 中预先声明相关脚本资源
