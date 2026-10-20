<div align="center">

<img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/brand/icon-app-128.png" width="76" height="76" alt="dsh-notify-me">

# dsh-notify-me

**离开 DSH 页面，也能及时知道何时需要回来。**

简体中文 | [English](README.en.md)

[![npm version](https://img.shields.io/npm/v/dsh-notify-me?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/dsh-notify-me)
[![npm downloads](https://img.shields.io/npm/dm/dsh-notify-me?style=flat-square&label=downloads%2Fmonth&color=1F883D)](https://www.npmjs.com/package/dsh-notify-me)
[![npm total downloads](https://img.shields.io/npm/dt/dsh-notify-me?style=flat-square&label=total%20downloads&color=1F883D)](https://www.npmjs.com/package/dsh-notify-me)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![DSH Web and Desktop](https://img.shields.io/badge/DSH-Web%20%7C%20Desktop-blue?style=flat-square)](#安装)
[![Client bundle size](https://img.shields.io/badge/client-%7E168%20KiB-green?style=flat-square)](lib/client.js)
[![DSH Compatibility](https://img.shields.io/badge/DSH-%E5%B7%B2%E9%80%82%E9%85%8D%200.2.1--rc.2-6366f1.svg?style=flat-square)](#兼容性)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

</div>

[安装](#安装) · [效果预览](#效果预览) · [配置](#在-dsh-设置里改配置) · [兼容性](#兼容性) · [更新日志](CHANGELOG.md)

DSH Web / Desktop 的通知插件，让你敢不开完整访问，也不必一直守着页面。

- **需要你操作时**：审批、方案确认、提问，用通知、提示音和标题标记提醒。
- **后台回复完成时**：及时回来查看结果，点击通知可回到对应对话。
- **离开电脑时**：可选转发到 Discord、Bark、Gotify 或自己的 Webhook。
- **不看主屏时**：提醒方式可以切成页面内浮层，跟着 DSH 窗口出现在你正看着的那块屏（系统通知只会出现在主屏）。

> 页面或桌面应用需保持运行，后台 / 最小化可以。系统通知需要通知权限；审批按钮在支持 Service Worker 的 Web 环境（如 `http://127.0.0.1` 或 `https`）由通知提供，桌面端的通知没有按钮——把「提醒方式」切到页面浮层「页面浮层提醒」后可在浮层上直接裁决（见[副屏与浮层提醒](#副屏与浮层提醒)）。

> 🔎 想找这个插件？可以搜：`dsh-notify-me`、**消息提醒**、**可操作提醒**、**桌面通知**、**需要你操作**、**回复完成提醒**、**后台完成提醒**、**外部通知**、**Discord / Bark / Gotify 推送**（npm 关键词已含以上中英文词）。

## 效果预览

![Windows 上经 Edge 显示的 DSH 普通通知，未包含审批按钮](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/notify-toast.png)

*普通通知示例 · Windows / Edge · 不含审批按钮。* [查看原图](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/notify-toast.png)

![DSH 页面右下角的三张浮层提醒：提问、审批请求（带「同意 / 拒绝」按钮）、回复完成](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/overlay-zh.png)

*页面浮层提醒（1.8.0）· 真实插件在独立演示页里渲染 · 系统通知画不到副屏时用它，卡片落在 DSH 窗口所在的那块屏。* [查看原图](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/overlay-zh.png)

<details>
<summary>展开设置界面预览</summary>

![通知提醒设置页：页眉、提醒方式、什么时候提醒、试一试与折叠的高级设置](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/settings-zh.png)

真实插件设置组件（v1.10.0 默认配置）在独立演示环境里渲染；提醒方式是一组单选，每行的说明在鼠标停在标题文字上时才出现，所以这里只看到标题。
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
2. 打开 **设置 → 通知提醒**，确认出现该分区及底部插件版本号，保持「启用提醒」「提示音」开启，提醒方式先留「系统通知」。
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

打开 **设置 → 通知提醒**。页面按「提醒方式 → 什么时候提醒 → 试一试」三段排开，不常改的收进底部「高级设置」，点一下展开。每行只写标题，具体说明在鼠标移上去时弹出的小方框里（触屏或键盘操作时留一份隐藏文本给读屏）。

### 提醒方式

- **启用提醒** 总开关：关闭后不弹通知、不响提示音，也不改标签页标题；
- **提醒方式（二选一）**：系统通知 / 页面浮层，单选，开了这个就不再弹那个；
  - **系统通知**（默认）：进 Windows / macOS 通知中心，需要通知权限；
  - **页面浮层**：在 DSH 页面角落画提醒卡片，窗口在哪块屏它就在哪块屏——系统通知只会画在主屏，主屏不看时用它；不需要通知权限，桌面端也能在卡片上直接「同意 / 拒绝」。选中后可选四个角落的位置，见[副屏与浮层提醒](#副屏与浮层提醒)；
- **提示音 / 音量**：提示音开关与音量滑块；具体播什么由「高级设置 → 音效来源」决定；
- **审批通知上直接裁决**（默认开）：审批通知带「同意 / 拒绝」，点一下即完成裁决，不用切回页面。**桌面端的通知没有按钮**（`dsh-app://` 页面无法注册 Service Worker），需要按钮就打开「页面浮层提醒」，改在浮层上裁决；设置页会如实说明当前哪种渠道能给按钮。

### 副屏与浮层提醒

Windows 的系统通知横幅固定画在主屏上，系统没有设置项、浏览器也没有 API 能把它挪到别的显示器。主屏不看、DSH 停在副屏时，通知就等于没发。

「页面浮层提醒」绕开系统通知中心，直接在 DSH 页面里画一张卡片：窗口在哪块屏，卡片就出现在哪块屏。

- **位置**：设置里选右上 / 右下 / 左上 / 左下，默认右下；改完立刻生效；
- **不需要通知权限**：通知权限没给、或桌面端弹不出带按钮的通知时，浮层照常工作；
- **审批卡片带「同意 / 拒绝」**：与审批卡片的「允许一次 / 拒绝」等价，桌面端也能用（不依赖 Service Worker）；点卡片正文则切回对应对话；
- **停留时间**：「需要你」12 秒，「回复完成」6 秒，带按钮的审批卡片 18 秒，都会自动收起；也可以点卡片或右上角叉提前关掉。最多同时叠 4 张；
- **与系统通知的关系**：二选一。以前两个开关可以同开，结果同一条提醒弹两遍、还互相挡住，1.10.0 起改成单选。老配置里开着浮层的，升级后自动落到浮层。

浮层只知道窗口在哪块屏，不知道你人在看哪块屏。窗口留在主屏、人却盯着副屏时，它同样看不见。

### 什么时候提醒

- **页面打开时也提醒「需要你」**（默认开）：页面在最前也提醒；关掉后只有切到后台才提醒；
- **当前对话不弹通知**（默认开）：等待就发生在你正看着的对话里时只留标签页标记，免得挡住审批卡片；切到后台后照常提醒，若你已处理掉就作废；
- **页面打开时也提醒「回复完成」**（默认关）：默认只在切到后台时提醒，避免打扰；
- **子代理会话不提醒**（默认开）：跳过后台子代理（subagent）会话——它们是主对话那一轮的步骤，完成由主对话自己的提醒覆盖；你当前打开的那个子代理会话照常提醒；
- **点击通知回到对应对话**（默认开）：点通知切到提醒所属的对话；浏览器里同时把窗口带到前台；桌面端不稳定——有时窗口会上前，有时只切对话（见[桌面端怎么抬窗的](#桌面端怎么抬窗的)）；多个标签页同时开着时只调起一个（优先当前可见的那个）；关掉后点通知不做任何事。

### 试一试

三个按钮分别发一条「需要你」「回复完成」「审批按钮」测试提醒，用当前设置立即发，**不受**「什么时候提醒」里的开关限制；下方一行如实说明当前哪种渠道能给审批按钮。

设置页底部常显插件版本号（`dsh-notify-me v…`）——报障、核对是否装上新版本时直接照抄这一行。

### 高级设置

默认收起，点一下展开。里面收着三块不常改的东西：音效来源、外部推送、运行环境与诊断——分别见下面三节。

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

### 运行环境与诊断

在「高级设置」最后一块。默认自动识别当前是 Web 端还是桌面端（DSH Desktop，`dsh-app://`）；识别不准时可手动指定——桌面端点通知走 `dsh://` 深链调窗（效果不稳定，见[桌面端怎么抬窗的](#桌面端怎么抬窗的)）、通知上不带快捷裁决按钮；Web 端走 `window.focus()` 与 Service Worker 桥。手动覆盖与自动识别不一致时，设置页会明示检测结果。

<details>
<summary>通知语言、桌面端抬窗与恢复默认</summary>

- **通知语言**：跟随界面 / 简体中文 / English——决定通知文字与 `🔔 …` 标题标记使用的语言；
- **桌面端怎么抬窗**：页面侧的 `window.focus()` 在 Electron 里抬不动原生窗口，1.5.2 起改走应用自己的 `dsh://open` 深链调窗——在 DSH Desktop 0.2.0-rc.2 上实测有效，0.2.1-rc.2 在 Windows 上不稳定（详见下一节）；
- **恢复默认设置**：把所有开关与音效设置还原成出厂值（不动外部推送目标和已选的自定义音频文件）。

</details>

> 左侧导航行的图标由 DSH 设置外壳统一渲染：外壳按分区 id 硬编码（只认 account / models / agent-presets / plugins / archived-sessions），其他分区一律给默认齿轮，`settings.section` 也没有图标字段。插件的做法是在设置面板渲染后替换那一行：按本地化标签文本找到自己的入口，把宿主的 `<svg>` 换成品牌铃铛（保留宿主给的 icon class），并用 MutationObserver 跟随重渲染；宿主改结构时会自动放弃、回落到齿轮。

> 需要浏览器通知权限：页面上点一下 → 允许；或地址栏锁 → 站点设置 → 通知 → 允许 → 刷新。macOS 还要在 系统设置 → 通知 里允许该浏览器。

## 五种提醒渠道

- **系统通知**：经浏览器弹出的系统通知，进 Windows 通知中心或 macOS 通知中心（点击回到提醒所属的对话；支持快捷裁决的 Web 环境可点审批按钮直接裁决，桌面端无按钮）
- **页面浮层**：画在 DSH 页面角落的提醒卡片，落在窗口所在的那块屏，可带「同意 / 拒绝」按钮；见[副屏与浮层提醒](#副屏与浮层提醒)

两种渠道在设置里二选一，不会同时出现。
- **提示音**：默认是 WebAudio 合成音（「需要你」与「完成」使用不同音型）；可在设置里为两类提醒分别换成自定义音频文件，或改成让操作系统播放它自己的通知音
- **标签页标题标记**：有待处理事项时，标题前出现 `🔔 需要你 · …` / `🔔 Action needed · …`；后台会话**完成但还没看**时出现 `✅ 回复完成 · …` / `✅ Reply finished · …`，打开对应会话（或它再次开跑）即消失。两种标记可同时出现，「需要你」在前；宿主改写标题后标记基于新标题重建
- **外部通知**（可选，默认关）：按设置里配的推送目标，把同一条提醒转发到 Discord Webhook / Bark / Gotify / 自定义 Webhook——临时离开电脑时，手机上的推送渠道照样收到

本插件是**浏览器层**实现：DSH 页面需保持打开（最小化/后台即可——那正是它监听的「离开」状态）。

## 兼容性

逐版本适配记录见 [package.json](package.json) 的 `dsh.compatibility.dshReleases`。当前宿主（`0.2.1-rc.2`）的安装门控只读 `peerDependencies` 与 `engines`，**不再读取这个字段**，所以它现在只是一份给人看的记录，不构成门禁。

实测**真正激活**（各自独立 profile 启动：插件条目进启动页 `__DSH_BOOT__` 且注入依赖解析通过、`/plugins/??dsh-notify-me/client.js&rev=…` 返回含新代码的构建，设置里出现「通知提醒」分区，即插件的 `apply` 确实执行）于 `0.1.2-rc.1`、`0.1.5-rc.1`、`0.1.5-rc.2` 与 `0.2.0-rc.2`；更早的 `0.1.1-rc.2` 亦验证过。

`0.2.1-rc.2`（当前 latest）另跑了一轮隔离验证：隔离 `DSH_HOME` 起 `dsh web`（70 个启动条目），插件条目排在第 59、`application` 批，三个注入目标都在且都排在它前面；`/plugins/??dsh-notify-me/client.js&rev=…` 返回 1.7.0 源码构建（140,153 B）；无头 Chromium 载入页面后 `apply` 正常执行，`window.__dshNotifyMe.debug()` 报 `uiSession: bound`、`uiSessionSource: sessionStatus`、`bridge: active`。宿主侧的形状与 `0.2.0-rc.2` 一致，没有需要改代码的地方。

<details>
<summary>宿主代际与适配排查细节</summary>

插件按宿主代际自动选源；下表是各形状的边界，不是门禁：

| 宿主代际 | 「需要你」交互来源 | 判断当前会话 | 点通知切会话 |
| --- | --- | --- | --- |
| `≤ 0.1.2-alpha.1` | 控制器快照的 `pending[]` | 快照 `current` | `sessions.open()` |
| `0.1.2-alpha.2 .. 0.1.6-alpha.1` | `uiSession.pendingInteractions` | 快照 `current` | `sessions.open()` |
| `≥ 0.1.6-alpha.2`（含 `0.2.0-rc.2`、`0.2.1-rc.2`） | `uiSession.sessionStatus` | `retainedBy.mainView` | `uiWorkspace.openSession()` |

区间仅作示意：插件按 store 形状自动选源（`sessionStatus` 存在即走新路），版本号只是各形状的出现边界。`package.json` 的 `peerDependencies` 范围决定 npm 的 peer 提示——`0.2.1-rc.2` 已落在 `>=0.2.0-rc.1 <0.3.0-0` 里，不需要豁免；`dshReleases` 只是存档，真实兼容性以逐版实测为准，未实测的新版本由形状驱动兜底。

两个坑值得记住：一是 `dsh.client.inject` 里列了新版运行时已不再提供的包，客户端条目会停在 `pending (waiting for services: …)` 而永不执行——1.1.3 在 `0.1.2-rc.1` 及以后正是这样失效的；二是宿主换存储/字段名时**不会报错**，提醒只会静默失效——`0.2.0-rc.2` 上 `pendingInteractions`→`sessionStatus`、`list.current`→`retainedBy.mainView`、`sessions.open()`→`uiWorkspace.openSession()` 都是这一类，所以每次适配都要用 `window.__dshNotifyMe.debug()` 确认真的是 `bound`、以及用的是哪个来源。`0.2.1-rc.2` 这两处都没有再变：`sessionStatus` 仍是 `{running, pendingInteraction, completionUnread}` 的 Map，`uiWorkspace.openSession(id)` 照旧，会话列表里仍然没有 `current`。

</details>

`1.9.0` 的界面重排没有放宽也没有收紧这个范围：设置页是纯 React 渲染 + 既有 CSS 变量（每个色值都带 fallback），没有引入任何新的宿主 API；浮层、标题标记、抬窗仍走 1.7 / 1.8 那几条路径。**0.1.1-rc.2 到 0.2.1-rc.2 的插件条目照旧兼容**，换回旧宿主也不需要改配置。新增的只有界面元素——设置页页眉的铃铛是插件自己画的 SVG（`docs/brand/`），与宿主无关。

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
  channel: "toast",          // 提醒方式：'toast' 系统通知 | 'overlay' 页面浮层，二选一
  sound: true,                // 提示音开关（含「系统通知音」模式）
  soundDone: "synth",         // 「完成」音效来源：'synth' 内置 | 'custom' 自定义文件 | 'system' 系统通知音
  soundAttention: "synth",    // 「需要你」音效来源，取值同上
  volume: 0.5,                // 音量 0~1
  autoFocus: true,            // 点通知回到提醒所属的对话
  quickActions: true,         // 审批通知上的「同意 / 拒绝」按钮
  overlay: false,             // 兼容字段，跟随 channel 同步（老配置靠它迁移）
  overlayCorner: "bottom-right", // 浮层位置：'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
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

**0.2.1-rc.2 在 Windows 上不稳定**（2026-10-20）：点通知的回调照常执行（`navigator.userActivation.isActive === true`、`visibilityState` 为 `hidden`），但窗口是否上前台时灵时不灵——有时会，有时只切对话、窗口不动。

插件这一侧为什么不能指望：把 `dsh://open` 深链单独拿出来复测（三种走法各 3 次：直接带参启动 exe、走系统协议激活、`WM_SYSCOMMAND` 真实最小化后再发），**全部失败**——带参第二实例每次都在约 130 ms 后以退出码 1 结束（不带参数则约 260 ms 退出码 0，属正常单实例让位），最小化窗口的 `IsIconic` 每次都保持 `true`。也就是说，能抬起来的那些次，多半是系统/Chromium 在通知被点击时自己激活了应用窗口，不是插件发的深链起了作用。

页面侧也没有替代通道：壳的 preload 只暴露 `dshDesktop`、目录选择、本地化这些，`DESKTOP_IPC` 里没有 focus/raise 类通道；主窗口的 `will-navigate` 对 `dsh:` 一律 `preventDefault()`。复现步骤与代码位置已提交到 [deepseek-harness discussions #10446](https://github.com/deepseek-ai/deepseek-harness/discussions/10446)。

</details>

## 已知限制

- 页面必须开着才会提醒（后台标签/最小化可以；关标签页即失效——浏览器层方案固有限制）。
- 通知经由浏览器弹出，需允许浏览器通知权限，且勿扰模式不能屏蔽它。
- 桌面端（DSH Desktop 0.2.1-rc.2 / Windows）点通知后窗口不一定上前台：有时会，有时只切对话。插件发的 `dsh://open` 深链单独复测 3/3 无效（详见[桌面端怎么抬窗的](#桌面端怎么抬窗的)），能抬的时候多半是系统/Chromium 在通知激活时自己把窗口带起来了（[discussions #10446](https://github.com/deepseek-ai/deepseek-harness/discussions/10446)）。
- 系统通知横幅只画在主屏：Windows 没有设置项、Chromium 没有 API 能把它指到别的显示器（多屏时副屏收不到系统通知）。要用副屏提醒，开「页面浮层提醒」，它会跟着 DSH 窗口走。
- 每次页面加载后第一次出声/弹通知前，需在页面上点击过一次（浏览器自动播放与权限策略）。
- 未授权通知权限时只有提示音与标题标记。
- 快捷裁决按钮要 Service Worker：`http://127.0.0.1`、`https` 可用，`http://192.168.x.x` 这类局域网地址不行；**桌面端（`dsh-app://`）已实测无法注册 Service Worker**，按钮渲染不了，审批通知退回无按钮样式。浏览器或桌面宿主不渲染通知按钮时，`window.__dshNotifyMe.debug()` 的 `bridge` 字段会说明原因，其余功能不受影响。
- macOS：浏览器里提醒、提示音、标题标记、点通知跳转都没有平台假设，照常工作；但 DSH Desktop（Electron）的系统通知要求应用已签名，未签名的通知直接发不出去，官方 macOS 版是否满足这一前提未实测；审批按钮在 macOS 桌面宿主上的渲染同样未实测（Windows 桌面端已实测不渲染，见上条），不渲染时自动退回无按钮通知。
- 配置存在浏览器 `localStorage`：换浏览器/设备或清除站点数据后会回到默认值（设置页可一键恢复默认）。
- `≥ 0.1.6`（含 `0.2.0-rc.2`、`0.2.1-rc.2`）的「回复完成」提醒正文只有会话名，不再附带回复摘要——宿主快照已不再提供 `nodes`；提醒本身照常触发。
- 标题标记由宿主与插件共同写 `document.title`：宿主重算标题时标记可能被覆盖，直到下一次提醒事件重新写成。
- 「当前对话不弹通知」按 `document.hidden` 判定：窗口被别的应用完全盖住时仍算「页面可见」，此时当前对话的等待照样静默。
- 外部通知转发受浏览器跨域（CORS）限制：端点不放行时自动降级为「送出但不可确认」（no-cors），如实标为「已送出不可确认」；Discord Webhook 官方放行跨域，可直接确认送达。HTTP 错误如实记失败、不重试。转发在本地提醒决定要发之后才触发，所以被「当前对话不弹通知」等规则静音的提醒也不会外发。

- **设置左侧导航行图标靠 DOM 补丁**：外壳按分区 id 硬编码图标且 `settings.section` 没有图标字段，插件只能在面板渲染后把那一行的 `<svg>` 换成铃铛。命中依赖宿主当前的面板结构（`data-shortcut-modal="settings"` + 导航按钮里的标签 `<span>`）；如果 DSH 改了这套结构，补丁会静默失效、显示回默认齿轮，其他功能不受影响。

## 开发自检

```powershell
node --check lib\client.js
node --check lib\index.js
node smoke\smoke-test.cjs        # 离线状态机冒烟测试：三代宿主 + 主开关 + 中英语言用例 + 快捷裁决桥（Service Worker 半侧一并跑）+ 页面浮层
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
