# 品牌标志

插件的标志只有一个母题：**一只铃铛，右上角一颗未读圆点**。铃铛是「提醒」，圆点是「等你处理的事还没消」。

![标志总览：线稿在浅色/深色底上的 16–48px 表现，应用图标 256/128/64/32/16px](preview.png)

## 文件

| 文件 | 用途 |
| --- | --- |
| `icon-outline.svg` | 24×24 线稿，`stroke="currentColor"`、描边 1.5，用于设置页页眉、文档内联；颜色跟文字走 |
| `icon-app.svg` | 512×512 应用图标（深蓝底 + 蓝色铃铛 + 琥珀圆点），留 112 圆角安全边距 |
| `icon-app-512.png` / `-256` / `-128` / `-64` / `-32` | 由 `icon-app.svg` 直接栅格化的位图，圆角外透明 |
| `favicon.svg` / `favicon-32.png` | 32×32 简化版：线宽放大到 1.9，圆点更大，缩到 16px 仍能分辨 |
| `preview.png` | 上面这张总览图，改标志后重新生成 |

## 用法

- 设置页页眉不加载文件，`lib/client.js` 的 `headIcon()` 里内联同一份 24×24 路径（插件不能保证静态资源可访问，内联最稳）。改标志时两处一起改：`docs/brand/icon-outline.svg` 与 `headIcon()`。
- 配色固定三个：底色 `#131C2E → #0B1018`（渐变）、铃铛 `#3B82F6`、圆点 `#F59E0B`。线稿不指定颜色，交给 `currentColor`。

## 为什么不能替换设置左侧导航那一行的图标

DSH 的设置外壳（`@deepseek-ai/dsh-client-ui-settings-general`）按分区 id 硬编码导航图标：只认 `account` / `models` / `agent-presets` / `plugins` / `archived-sessions`，其余分区一律 `IconSettingsOutlineMedium`（默认齿轮），`settings.section` 账本里也没有图标字段。所以 1.9.1 起改成渲染后补丁：插件按本地化标签找到自己那一行的导航按钮，把宿主生成的 `<svg>` 换成同款铃铛，并沿用宿主给的 icon class。宿主换结构时补丁自动放弃，回落到默认齿轮。

<details>
<summary>展开补丁的实现方式</summary>

`lib/client.js` 的 `installNavBell()` 在设置面板打开后执行。class 名是 CSS module hash，跨版本会变，不能写死；面板每次打开都是新的 portal，因此用 MutationObserver 跟随重渲染。

</details>

## 重新生成位图

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9444
node docs/brand/render-icons.mjs
```

`render-icons.mjs` 通过 CDP 让 headless Edge 按目标尺寸渲染 SVG（透明背景），并重拍 `preview.png`。它需要那个 9444 端口的浏览器，别对着自己日常的 Edge 窗口跑；上面的 Edge 路径按你本机的安装位置改。
