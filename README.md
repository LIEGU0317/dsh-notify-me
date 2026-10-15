# dsh-notify-me

**离开 DSH 页面，也能及时知道何时需要回来。**

简体中文 | [English](README.en.md)

[![npm version](https://img.shields.io/npm/v/dsh-notify-me?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/dsh-notify-me)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![DSH Web and Desktop](https://img.shields.io/badge/DSH-Web%20%7C%20Desktop-blue?style=flat-square)](#安装)
[![Client bundle size](https://img.shields.io/badge/client-%7E137%20KiB-green?style=flat-square)](lib/client.js)

[安装](#安装) · [效果预览](#效果预览) · [配置](#在-dsh-设置里改配置) · [兼容性](#兼容性) · [更新日志](CHANGELOG.md)

DSH Web / Desktop 的通知插件，让你敢不开完整访问，也不必一直守着页面。

- **需要你操作时**：审批、方案确认、提问，用通知、提示音和标题标记提醒。
- **后台回复完成时**：及时回来查看结果，点击通知可回到对应对话。
- **离开电脑时**：可选转发到 Discord、Bark、Gotify 或自己的 Webhook。

> 页面或桌面应用需保持运行，后台 / 最小化可以。系统通知需要通知权限；审批按钮仅在支持 Service Worker 的 Web 环境可用（如 `http://127.0.0.1` 或 `https`），桌面端使用无按钮通知。

## 效果预览

![Windows 上经 Edge 显示的 DSH 普通通知，未包含审批按钮](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/notify-toast.png)

*普通通知示例 · Windows / Edge · 不含审批按钮。* [查看原图](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/notify-toast.png)

<details>
<summary>展开设置界面预览</summary>

![通知提醒设置：启用提醒、运行环境、通知与会话规则](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/settings-zh.jpg)

真实插件设置组件，使用 v1.7.0 默认配置在独立演示环境中渲染；展示基础设置区域，不包含 DSH 宿主外壳。

</details>

## 安装

### DSH Web

已安装 DSH CLI 的用户，在终端执行：

```powershell
# 安装并自动挂载进 web profile
dsh plugin --profile web add dsh-notify-me
```

重启 `dsh web`，然后硬刷新页面（Ctrl+Shift+R）。如果你使用其他 Web profile，请把命令中的 `web` 换成实际名称。

### DSH Desktop

1. 在桌面应用打开 **插件 → 添加插件**。
2. 输入 npm 包名 `dsh-notify-me`，按应用提示完成安装，并确认插件已启用。
3. 完全退出并重新启动 DSH Desktop，使插件加载。

桌面端的 `desktop` profile 由 Electron 应用管理；不要把上面的 Web 命令改成 `--profile desktop`，CLI 会拒绝此操作。安装到 Web profile 也不会自动安装到桌面端。

## 首次验证

1. 在 DSH 页面上点击一次，按提示允许通知；若此前拒绝过，在浏览器站点设置中允许通知。操作系统也需要允许对应浏览器 / DSH Desktop 显示通知。
2. 打开 **设置 → 通知提醒**，确认出现该分区及底部插件版本号，保持「启用提醒」「系统通知」「提示音」开启。
3. 点击设置页的「测试『回复完成』」按钮：应出现一条测试通知，并按当前音效设置播放声音。这个本地测试不会转发到外部通知端点，也不受「页面打开时也提醒」开关限制。

Web 用户可再测试审批按钮；桌面端该测试只发普通通知，**没有「同意 / 拒绝」按钮属于预期行为**。

**控制台验证（可选）** — 支持 DevTools 的环境也可执行：

```js
window.__dshNotifyMe.test("done")        // 「完成」示例
window.__dshNotifyMe.test("attention")   // 「需要你」示例
window.__dshNotifyMe.test("approval")    // Web 桥可用时带「同意 / 拒绝」按钮；桌面端为无按钮通知
window.__dshNotifyMe.debug()             // 桥接状态看 bridge 字段，active = 按钮可用
```

没有测试通知时，先检查：通知权限是否被拒绝（在页面上点一下 → 选「允许」；或地址栏锁 → 站点设置 → 通知 → 允许 → 刷新）、装完没重启 DSH、系统设置里浏览器通知被关。

## 为什么需要它

- **不开完整访问（`workspace-write` + ask）**：保留事前审批，但错过请求会让 agent 等待。
- **开完整访问（full access）**：减少审批打断，同时放弃事前拦截能力。

dsh-notify-me 把「监督」和「守在屏幕前」解耦：只在真的出现决策点（审批 / 方案确认 / 提问）或回复跑完时，才用系统通知把你叫回来——**让你敢不开完整访问**，不必靠放弃拦截能力来换效率。它不降低 full access 本身的权限风险（它不是沙箱），只是减少 ask 模式下因错过审批而产生的等待。

## 提醒时机

| 事件 | 默认行为 |
| --- | --- |
| 🔔 需要你操作 | 页面可见也提醒；当前对话只留标题标记 |
| ✅ 回复完成 | 页面隐藏 / 后台时提醒 |

**需要你操作**包括审批请求、方案待确认（plan review）和提问（`ask_user_question`）。支持快捷裁决的 Web 环境会显示「同意 / 拒绝」按钮，桌面端无按钮。

**回复完成**也覆盖后台会话；完成但还没看时，标题带 `✅ 回复完成 ·` 标记，打开对应会话即撤。标题标记不受「页面打开时也提醒」开关限制。

> **后台**子代理（subagent）子会话的等待与完成默认**不提醒**：DSH 把每个子代理子会话列成独立会话，但它们是所属主对话那一轮里的步骤，提醒只会是噪音。你当前打开的那个子代理会话不算在内，照常提醒。设置页「子代理会话不提醒」可关掉这个静音。

## 在 DSH 设置里改配置

打开 **设置 → 通知提醒**，常用项分为以下几组。

### 基础设置

- **启用提醒** 主开关：关闭后不再弹系统通知、不播放提示音、也不改标签页标题；
- **系统通知 / 提示音 / 音量**：Toast、提示音开关与音量滑块；
- **通知语言**：跟随界面 / 简体中文 / English——决定通知文字与 `🔔 …` 标题标记使用的语言；
- **测试按钮**：用当前设置立即发一条「需要你」「回复完成」或「审批按钮」测试提醒（**不受**上面「页面打开时也提醒」开关限制；「需要你」测试的标题标记约 6 秒后自动消失）；
- **版本信息**：设置页底部常显当前插件版本号（`dsh-notify-me v…`）——报障、核对是否装上新版本时直接照抄这一行。

### 提醒与点击行为

- **页面打开时也提醒「需要你」**（默认开）与 **页面打开时也提醒「回复完成」**（默认关）；
- **当前对话不弹通知**（默认开）：等待就发生在你正看着的对话里时只留标题标记，不弹通知也不响音（免得盖住审批卡片）；页面切到后台立刻补发，若你已经处理掉就作废。其它后台会话不受影响；
- **子代理会话不提醒**（默认开）：后台子代理（subagent）子会话的「需要你」与「回复完成」都不提醒——它们是主对话那一轮的步骤，完成由主对话自己的提醒覆盖；你当前打开的那个子代理会话照常提醒；关掉后恢复逐会话提醒；
- **审批通知上直接裁决**（默认开）：权限审批的通知上带「同意 / 拒绝」按钮，点一下就按审批卡片的「允许一次 / 拒绝」直接裁决，不用切回页面；点通知正文仍是原来的「切回对应对话」。**桌面端暂不支持按钮**（`dsh-app://` 页面无法注册 Service Worker），审批通知自动退回无按钮样式，设置页会明示这一限制；

<details>
<summary>运行环境、点击回到对话与多窗口细节</summary>

- **运行环境**（默认自动识别）：按页面协议识别 Web 端 / 桌面端（DSH Desktop，`dsh-app://`），识别不准时可手动指定——桌面端点通知走 `dsh://` 深链抬窗、快捷裁决按钮不可用；Web 端走 `window.focus()` 与 Service Worker 桥。手动覆盖与自动识别不一致时，设置页会明示检测结果；
- **点击通知回到对应对话**（默认开）：点通知把 DSH 带到前台并切到提醒所属的对话；多个 DSH 标签页同时开着时，一次点击只调起一个窗口（优先当前可见的那个）并只切它的对话，其余标签页不动；关掉后点通知不做任何事。桌面端（DSH Desktop）同样会把窗口带到前台并切对话：页面侧的 `window.focus()` 在 Electron 里抬不动原生窗口，1.5.2 起改走应用自己的 `dsh://open` 深链调窗（窗口隐藏在托盘里也能被抬回来）；

</details>

### 音效

「需要你」与「回复完成」可独立选择内置合成音、自定义音频或系统通知音。

<details>
<summary>自定义音频、试听与回落规则</summary>

- **音效来源**（「需要你」与「回复完成」各自独立选）：内置合成音（默认）/ 自定义音频文件 / 系统通知音。选「自定义音频文件」可在设置页挑一个本地音频（上限 1 MiB，存在浏览器本地，可试听与移除）；选「系统通知音」则完全不播插件音效，通知照发，声音交给操作系统（音色跟着系统通知设置走），此时「试听」会改发一条测试通知——该模式没有插件可播的音，你听到的就是它。任一来源缺文件、读不出来或存不下时自动回落到内置合成音，提醒不会因此变成哑的；

</details>

### 外部推送

默认关闭。支持 Discord Webhook / Bark / Gotify / 自定义 Webhook；提醒正文会发往你填写的地址，只使用可信端点。

<details>
<summary>目标地址、转发开关与发送测试</summary>

- **外部通知**（默认关）：把提醒同时转发到你自己的推送端点，人不在电脑前也能收到——支持 **Discord Webhook** / **Bark** / **Gotify** / **自定义 Webhook**，可加多个目标，每个选类型填地址（Discord 填 Webhook 地址；Bark 填 `https://api.day.app/<设备密钥>`；Gotify 填 `https://<服务器>/message?token=<应用令牌>`；自定义端点收一条 POST JSON：`{source, event, title, body, sessionId, time}`）；「转发「需要你」」「转发「回复完成」」各自独立开关；**发送测试通知**往所有目标发一条测试消息（不受这两类开关限制，也不会冒充真提醒）。转发跟本地提醒走同一套触发规则（「当前对话不弹通知」等开关同样管它）；提醒正文会原样发往你填的地址，**只填你自己信任的端点**；

</details>

> 需要浏览器通知权限：页面上点一下 → 允许；或地址栏锁 → 站点设置 → 通知 → 允许 → 刷新。macOS 还要在 系统设置 → 通知 里允许该浏览器。

## 提醒方式

- **系统通知**：经浏览器弹出的系统通知，进 Windows 通知中心或 macOS 通知中心（点击回到提醒所属的对话；支持快捷裁决的 Web 环境可点审批按钮直接裁决，桌面端无按钮）
- **提示音**：默认是 WebAudio 合成音（「需要你」与「完成」使用不同音型）；可在设置里为两类提醒分别换成自定义音频文件，或改成让操作系统播放它自己的通知音
- **标签页标题标记**：有待处理事项时，标题前出现 `🔔 需要你 · …` / `🔔 Action needed · …`；后台会话**完成但还没看**时出现 `✅ 回复完成 · …` / `✅ Reply finished · …`，打开对应会话（或它再次开跑）即消失。两种标记可同时出现，「需要你」在前；宿主改写标题后标记基于新标题重建
- **外部通知**（可选，默认关）：按设置里配的推送目标，把同一条提醒转发到 Discord Webhook / Bark / Gotify / 自定义 Webhook——临时离开电脑时，手机上的推送渠道照样收到

本插件是**浏览器层**实现：DSH 页面需保持打开（最小化/后台即可——那正是它监听的「离开」状态）。

## 兼容性

逐版本兼容声明以 [package.json](package.json) 的 `dsh.compatibility.dshReleases` 为准。

实测**真正激活**（各自独立 profile 启动：设置里出现「通知提醒」分区，即插件的 `apply` 确实执行）于 `0.1.2-rc.1`、`0.1.5-rc.2` 与 `0.2.0-rc.2`；更早的 `0.1.1-rc.2` 亦验证过。

<details>
<summary>宿主代际与适配排查细节</summary>

插件按宿主代际自动选源，逐版本声明见 `package.json` 的 `dsh.compatibility.dshReleases`：

| 宿主代际 | 「需要你」交互来源 | 判断当前会话 | 点通知切会话 |
| --- | --- | --- | --- |
| `≤ 0.1.2-alpha.1` | 控制器快照的 `pending[]` | 快照 `current` | `sessions.open()` |
| `0.1.2-alpha.2 .. 0.1.6-alpha.1` | `uiSession.pendingInteractions` | 快照 `current` | `sessions.open()` |
| `≥ 0.1.6-alpha.2`（含 `0.2.0-rc.2`） | `uiSession.sessionStatus` | `retainedBy.mainView` | `uiWorkspace.openSession()` |

区间仅作示意：插件按 store 形状自动选源（`sessionStatus` 存在即走新路），版本号只是各形状的出现边界。`package.json` 的 `peerDependencies` 范围同理只影响 npm install 的提示文案——兼容与否以 `dshReleases` 的逐版实测声明为准，未实测的新版本由形状驱动兜底。

两个坑值得记住：一是 `dsh.client.inject` 里列了新版运行时已不再提供的包，客户端条目会停在 `pending (waiting for services: …)` 而永不执行——1.1.3 在 `0.1.2-rc.1` 及以后正是这样失效的；二是宿主换存储/字段名时**不会报错**，提醒只会静默失效——`0.2.0-rc.2` 上 `pendingInteractions`→`sessionStatus`、`list.current`→`retainedBy.mainView`、`sessions.open()`→`uiWorkspace.openSession()` 都是这一类，所以每次适配都要用 `window.__dshNotifyMe.debug()` 确认真的是 `bound`、以及用的是哪个来源。

</details>

## 控制台高级配置

设置页是第一入口；想脚本化/批量改或恢复默认时，偏好存 `localStorage`（`dshNotifyMe.config`），可用控制台实时调整：

<details>
<summary>展开控制台 API 与存储说明</summary>

```js
window.__dshNotifyMe.config                       // 查看
window.__dshNotifyMe.setConfig({
  enabled: true,           // false = 关闭所有提醒（主开关）
  language: "auto",        // 'auto' 跟随界面 | 'zh' 简体中文 | 'en' English
  attentionHiddenOnly: false, // true = 页面可见时「需要你」不提醒
  currentHiddenOnly: true,    // true = 当前对话的等待只留标题标记（转后台补发）
  doneHiddenOnly: true,       // false = 页面可见时「完成」也提醒
  ignoreSubagent: true,       // true = 后台子代理（subagent）会话不提醒（当前打开的照常）
  toast: true,                // 系统通知开关
  sound: true,                // 提示音开关（含「系统通知音」模式）
  soundDone: "synth",         // 「完成」音效来源：'synth' 内置 | 'custom' 自定义文件 | 'system' 系统通知音
  soundAttention: "synth",    // 「需要你」音效来源，取值同上
  volume: 0.5,                // 音量 0~1
  autoFocus: true,            // 点通知回到提醒所属的对话
  quickActions: true,         // 审批通知上的「同意 / 拒绝」按钮
  externalEnabled: false,     // 外部通知转发主开关（默认关：不填端点就什么都不发）
  externalAttention: true,    // 转发「需要你」（触发规则跟本地提醒完全一致）
  externalDone: true,         // 转发「回复完成」
  externalTargets: []         // 推送目标：[{id, type:'discord'|'bark'|'gotify'|'custom', url}]
})
window.__dshNotifyMe.resetConfig()                // 恢复默认（同时清掉已选的自定义音效文件）
window.__dshNotifyMe.decide("approval:3", "allowed-once")  // 程序化裁决："allowed-once" | "rejected"
window.__dshNotifyMe.testExternal()               // 显式外发测试：向有效目标发送，返回 {sent, unverified, failed, statuses}
```

> **外部通知测试的开关边界**：设置页「发送测试通知」要求「启用提醒」与「外部通知」主开关开启，但忽略两类提醒的转发开关。控制台 `testExternal()` 是显式测试调用：只要配置了有效目标，即使上述主开关关闭，也会向这些目标发送测试消息；没有有效目标则不发送。普通的 `test("done")` / `test("attention")` / `test("approval")` 只测试本地提醒，不外发。

> 自定义音效文件不在 `dshNotifyMe.config` 里，而是按类别各存一个键（`dshNotifyMe.sound.done` / `dshNotifyMe.sound.attention`，内容是 `{name, size, data}` 的 data URL）——一个文件转成 data URL 会膨胀约 1.37 倍，塞进配置会拖慢每次读取。`resetConfig()` 会连这两个键一起清掉。
>
> 想确认当前生效的来源，看 `window.__dshNotifyMe.debug()` 的 `soundDone` / `soundAttention` 与 `customSoundDone` / `customSoundAttention`。

</details>

## 工作原理

提醒核心监听会话状态与待处理交互；审批裁决由页面侧完成，桌面抬窗使用应用深链。

<details>
<summary>展开事件来源、审批桥接与桌面抬窗实现</summary>

提醒核心按宿主代际取源（见上表），当前会话一律来自客户端 `sessions` 服务：

- **当前会话** `SessionSnapshot`：`running` true→false = 回复完成；
- **待办交互**：`uiSession` 的 `sessionStatus`（`≥ 0.1.6`，逐会话 `pendingInteraction`）或 `pendingInteractions`（`0.1.2 .. 0.1.5`）出现新 key = 模型在等你，容器里带上审批工具名 / 理由、提问文本；旧宿主回落到控制器快照的 `pending[]`；
- **其它已列会话**摘要：`running` true→false（或旧宿主的 `completed` 边沿）= 后台工作提醒。宿主的「完成未读」级别标志负责补漏与标题标记：`≥ 0.1.6` 用 `sessionStatus` 行的 `completionUnread`（后台会话完成即点亮、打开该会话/再次开跑/会话消失即清零），旧宿主用列表行的 `completed` 提醒位（选中会话即清零）；页面没看见的完成边沿（插件热重载中途、快照合并跳变）由此补报一次，边沿与级别标志同来时按短时间窗合并，只响一声。
- **子代理会话**：列表行带 `origin: 'subagent'`（并有 `parentId`）的**后台**会话默认静音；你正打开着的那个子代理会话不算静音对象，它的提醒走当前对话的常规规则（页面可见时默认只留标题标记、转后台补发），切进来时积压的等待同样补上，切走后重新静音。只有 `parentId`、没有 `origin` 的分支（fork）会话属于你自己的对话，始终照常提醒。

提醒核心仍然零第三方运行时依赖、完全自包含：通知文字按所选语言（跟随界面 / 中文 / English）即时解析。设置页是**可选**的 React 呈现层——当 DSH web profile 提供 `slots` / `locale` / `react` 时才注册进「设置 → 通知提醒」，缺任一能力时插件自动降级为纯提醒（无设置页），不影响功能。

### 快捷裁决怎么走通的

通知按钮（`actions`）只属于 Service Worker 弹的持久通知，往 `new Notification()` 里传 `actions` 会直接抛 `TypeError`——这是绕不开的浏览器限制。所以 bundle 一份文件干两件事：页面里照常注册提醒工厂，同一份字节再注册成一个只干转信的 Service Worker，把「点了哪个按钮」（同意 / 拒绝 / 点正文）带回页面。真正的裁决发生在页面里，调的是审批卡片自己用的 `PendingApproval.answer('allowed-once' | 'rejected')`，所以「同意」就是「允许一次」，不多放行任何东西。点正文的「调窗口 + 切对话」同样归 worker 这半侧调度：它用 `client.focus()` 只调起一个窗口（优先当前可见的），并只让那个窗口切对话——多个 DSH 标签页不会互相抢焦点或一起乱切。

每条按钮通知按交互 key 记账，一次只认领一条等待；请求被页面里答掉、或被新请求顶替之后，残留通知上的按钮再点也不会误裁，只是安静地关掉。带按钮的通知不设自动消失——审批没裁决就一直留在通知中心里等你。

### 桌面端怎么抬窗的

DSH Desktop 是一层 Electron 壳，页面跑在 `dsh-app://app` 下：DOM 的 `window.focus()` 只动浏览器窗口对象、碰不到原生窗口，壳的 `will-navigate` / `window-open` 又把页面里发 `dsh://` 的常规出口全堵上了——所以 1.5.1 及以前点通知只在后台切好对话，窗口不上前台。1.5.2 起点通知正文时页面发一条隐藏 iframe 导航到 `dsh://open`：子框架导航不经过壳的 `will-navigate` 拦截，URL 交给系统协议注册，应用的单实例锁收到第二次启动后走 `focusPrimaryWindow()`（restore + show + focus）——与登录完成页把客户端置前是同一条路。窗口隐藏在托盘、被别的窗口压住、最小化，都能被抬回来。浏览器端不受影响，仍走 `window.focus()` / worker `client.focus()`。

真实壳已实测（DSH Desktop 0.2.0-rc.2，issue #9 三轮复测）：点通知 = 抬窗 + 切会话一步到位，跨会话、窗口在后台时同样稳定。触发时机是这条链路的关键：深链必须在**带用户手势的处理器**里发——通知的 `onclick` 自带手势，所以产品路径通；而无手势的脚本化注入（如 CDP evaluate 手工塞 iframe）会被 Chromium 静默丢弃、外部协议根本不回流，复现时看起来就像「通道被拦死」。

</details>

## 已知限制

- 页面必须开着才会提醒（后台标签/最小化可以；关标签页即失效——浏览器层方案固有限制）。
- 通知经由浏览器弹出，需允许浏览器通知权限，且勿扰模式不能屏蔽它。
- 每次页面加载后第一次出声/弹通知前，需在页面上点击过一次（浏览器自动播放与权限策略）。
- 未授权通知权限时只有提示音与标题标记。
- 快捷裁决按钮要 Service Worker：`http://127.0.0.1`、`https` 可用，`http://192.168.x.x` 这类局域网地址不行；**桌面端（`dsh-app://`）已实测无法注册 Service Worker**，按钮渲染不了，审批通知退回无按钮样式。浏览器或桌面宿主不渲染通知按钮时，`window.__dshNotifyMe.debug()` 的 `bridge` 字段会说明原因，其余功能不受影响。
- macOS：浏览器里提醒、提示音、标题标记、点通知跳转都没有平台假设，照常工作；但 DSH Desktop（Electron）的系统通知要求应用已签名，未签名的通知直接发不出去，官方 macOS 版是否满足这一前提未实测；审批按钮在 macOS 桌面宿主上的渲染同样未实测（Windows 桌面端已实测不渲染，见上条），不渲染时自动退回无按钮通知。
- 配置存在浏览器 `localStorage`：换浏览器/设备或清除站点数据后会回到默认值（设置页可一键恢复默认）。
- `≥ 0.1.6`（含 `0.2.0-rc.2`）的「回复完成」提醒正文只有会话名，不再附带回复摘要——宿主快照已不再提供 `nodes`；提醒本身照常触发。
- 标题标记由宿主与插件共同写 `document.title`：宿主重算标题时标记可能被覆盖，直到下一次提醒事件重新写成。
- 「当前对话不弹通知」按 `document.hidden` 判定：窗口被别的应用完全盖住时仍算「页面可见」，此时当前对话的等待照样静默。
- 外部通知转发受浏览器跨域（CORS）限制：端点不放行时自动降级为「送出但不可确认」（no-cors），如实标为「已送出不可确认」；Discord Webhook 官方放行跨域，可直接确认送达。HTTP 错误如实记失败、不重试。转发在本地提醒决定要发之后才触发，所以被「当前对话不弹通知」等规则静音的提醒也不会外发。

## 开发自检

```powershell
node --check lib\client.js
node --check lib\index.js
node smoke\smoke-test.cjs        # 离线状态机冒烟测试：三代宿主 + 主开关 + 中英语言用例 + 快捷裁决桥（Service Worker 半侧一并跑）
node smoke\cordis-host-test.mjs  # 真 cordis 端到端（找不到本机 DSH 时自动跳过）
npm pack --dry-run               # 预览发布包
```

`cordis-host-test.mjs` 会从本机 DSH 安装借 `@deepseek-ai/cordis`（依次探测 npm 全局目录、`~/.dsh/profiles/web/node_modules` 与 `~/.dsh/profiles/node_modules` 平铺回退目录）；源码 checkout 里没有 profile 依赖时，用 `DSH_CORDIS_PATH=<checkout>/vendor/cordis/lib/index.js` 指定即可。

## 致谢与贡献须知

贡献者（按 handle 列出，链接指向他们参与的 PR / issue）：

- [@AgMahone](https://github.com/AgMahone) — [#7](https://github.com/chromoany/dsh-notify-me/pull/7)：0.1.6+ / 0.2.0 宿主代际支持，以及通知双响、cordis 查找路径的报障与复测；
- [@d0ublecl1ck](https://github.com/d0ublecl1ck) — [#8](https://github.com/chromoany/dsh-notify-me/pull/8)：子代理会话静音（`ignoreSubagent`）与配套测试、文档；1.4.0 里「只静音后台子代理、当前打开的照常提醒」的口径同样出自他在 #8 讨论里的建议，落地由维护者完成；
- [@EliteOtaku](https://github.com/EliteOtaku) — [#9](https://github.com/chromoany/dsh-notify-me/issues/9)：桌面端抬窗链路（1.5.2）的逐层排查与真实壳三轮复测——确认点通知抬窗 + 切会话稳定生效，并定位出「无用户手势的脚本化注入被 Chromium 静默丢弃」这一复现差异，纠正了最初「沙箱拦死」的判断；
- [@Wh1stle05](https://github.com/Wh1stle05) — [#10](https://github.com/chromoany/dsh-notify-me/pull/10)：「音效来源」功能（内置合成音 / 自定义音频文件 / 系统通知音，「需要你」与「回复完成」各自独立选），含设置页交互、回落链与测试、文档；「系统通知音」试听改发测试通知、假 React 按索引跨渲染保持 hook 状态这两处修正同样出自该 PR。
- [@yanzhaohui1999](https://github.com/yanzhaohui1999) — [#13](https://github.com/chromoany/dsh-notify-me/issues/13) / [#14](https://github.com/chromoany/dsh-notify-me/pull/14)：482 个会话下空闲页面烧 CPU 的性能报告（定位到 `currentSessionId()` 每行重扫全表，实测占 CPU 5.9%~6.5%）与修复（一次列表变化只推导一次「当前会话」），并带先红后绿的回归断言——4 行与 40 行的列表变化代价必须相等（上游报 7 vs 43，修后 5 vs 5）。
- [@RiZhiZhaoYi](https://github.com/RiZhiZhaoYi) — [#12](https://github.com/chromoany/dsh-notify-me/issues/12)：外部通知转发（Discord Webhook / Bark / Gotify / 自定义 Webhook）的功能建议与使用场景（1.7.0）。

署名口径：本仓库收编外部 PR 时以维护者提交落地——不沿用原 commit、不挂 Co-authored-by，GitHub 的 contributors 图只显示维护者，贡献者以上面的致谢署名。

## License

MIT — 见 [LICENSE](LICENSE)。

<details>
<summary>下载统计与插件收录</summary>

[![npm downloads](https://img.shields.io/npm/dm/dsh-notify-me?style=flat-square&label=downloads%2Fmonth&color=1F883D)](https://www.npmjs.com/package/dsh-notify-me)
[![npm total downloads](https://img.shields.io/npm/dt/dsh-notify-me?style=flat-square&label=total%20downloads&color=1F883D)](https://www.npmjs.com/package/dsh-notify-me)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

> 🔎 想找这个插件？可以搜：`dsh-notify-me`、**消息提醒**、**可操作提醒**、**桌面通知**、**需要你操作**、**回复完成提醒**、**后台完成提醒**、**外部通知**、**Discord / Bark / Gotify 推送**（npm 关键词已含以上中英文词）。

</details>
