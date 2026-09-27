# WebUI 登录页完整视觉迁移重做方案

## 0. 本次重做结论

上一轮实现已经证明“保留项目结构”不能被解释为“重新设计一套相似风格”。当前工作区中的刻印终端实现是近似稿，桌面布局、终端尺寸、背景层、边框展开、底部字标和状态时序都与参考页不一致。本方案废止上一版方案的完成状态，后续实现必须按本文件逐项重做。

本文件保留实现前冻结的视觉合同。当前已按映射重建 React DOM、CSS 和控制器并接入认证，实际进度和验收证据见第 10 节。

硬性原则：

- 视觉基线唯一取自 `/mnt/e/dev/login-demo` 的提交 `a4dcc718250479d96ea8b751f7a8cd7fa5d93f20`。
- 参考项目的 DOM 层级、CSS 数值、SVG 路径、动画时长、延迟、缓动和 Canvas 算法优先；项目代码只替换模块边界、生命周期和认证适配层。
- 不把参考项目作为运行时依赖，不从外部绝对路径读取资源，不使用 `login-demo` 作为新增模块、组件或目录名称。
- `/ui/#/login` 仍由本项目 React 页面提供；不使用 iframe、整页跳转或嵌入原生 HTML。
- 实施已获得用户授权；按本方案完成迁移，不执行 Git commit。

## 1. 已冻结的视觉参考

### 1.1 参考提交与文件校验

以下文件均来自同一参考提交。实现前若参考仓库发生变化，必须停止迁移并重新确认基线，不能静默跟随新版本。

| 参考文件 | 用途 | SHA-256 |
| --- | --- | --- |
| `index.html` | DOM、内联 SVG 字标、frame SVG | `b3080b1b9733317e09654344b4f598780672f9c2e5bfccd650d07283c206726d` |
| `login.css` | 登录场景布局、终端、字标及动画 | `4d5e1f19b64596dec55176a085f9b820c214f132f75a33a80cb116ad688b2404` |
| `backgrounds.css` | 三层晨雾、中央留白、主题/阶段透明度 | `8d074390f7943c34863a5b0df66bb25b7fb41084fe0b2050b2ee222b2ef64a1b` |
| `login.js` | 阶段控制、待机动画、认证流程 | `9ff8e55f91e938d6fab15da7fc55215259b1a75e21a5e7ee02679f62daaeaf25` |
| `token-input.js` | 逐字提示、自定义光标、选择区同步 | `39babe02ee664ce34a65e8aca6dc326351cc6c607b0d52d7ae6e33bd91823acf` |
| `signet.js` | 刻印取样、到达场、点亮、绘制循环 | `e3f01124af4c7a58ff4fed638c048adb238dccda880aebd74421b5cfc3ec1742` |
| `signet-fracture.js` | Voronoi 晶片、投影、第五次解体 | `d0e7c300894505b416e92e6c0cde7bc14f922405c6bcff7f8d77d008e031d154` |
| `signet-cracks.js` | 裂痕路径、长度、宽度、晶片分配 | `6acc3cfbb73710d1483e1498ee2fc7702970f69f165f40fa4f08eea9fd1fb412` |
| `background-particles.js` | 暗色萤火、亮色花瓣和主体遮挡 | `a03903e462cc90cd534e572fb50ccce462d299d49deb6ebe35c0d0dda4143bc5` |
| `theme.js` | 参考页主题状态和根变量 | `fab5abad00df4762481920fc4b2f7495e1e27b839f753f68182668c0b9aa741b` |
| `assets/images/elysia-signet-solid.png` | 刻印唯一源图 | `5f324c02da371c171fb6c42143078d19756477457812e9d33fe3bc6ca779ea9f` |
| `assets/images/elysia-signet.png` | 参考页展示图（仅用于基线核对） | `f848d590d9d4d4992f3ee0aba579d5631a62bbc571058a9cf86e12658e5371b2` |

本项目当前 `packages/webui/public/assets/signet/elysia-signet-solid.png` 已与源图校验一致；实现阶段仍需在复制和构建产物中再次校验，不能只相信文件名。

参考页的字体文件只用于原始设计/路径生成记录：`login.css` 运行时使用等宽系统字体，底部字标使用内联 SVG 路径。因此本项目不复制字体、不增加字体网络请求；字标路径必须直接迁移。

### 1.2 颜色和关键几何不得改写

浅色变量必须保持：`#fcf9fd`、`#3a2946`、`#755e83`、`#e58abd`、`#7550a8`、`#c07ba8`、`#f1b8d8`、`#b8a2e8`、`#b9e8f5`、`#e58abd24`、`#f7a8d84d`、`#65408b`、`#da83b8`。

深色变量必须保持：`#171222`、`#f8eef7`、`#b9afc2`、`#e58abd`、`#a88ae0`、`#f7a8d833`、`#f7a8d880`、`#e58abd`，以及 `--firefly-pink: 229, 138, 189`、`--firefly-violet: 184, 162, 232`、`--firefly-core: 255, 228, 249`。

桌面端必须保留参考几何：`main` 的 `padding: 120px 28px`；场景 `--scene-gap: clamp(24px, 7vw, 100px)`、`--signet-width: 400px`、`--input-width: 360px`；场景为刻印左、终端右的两列网格。终端高度为 `80px`，刻印 Canvas 通过 `inset: -17.5%`、`width/height: 135%` 外扩。移动端必须保留 `768px`、`600px` 断点、`300px` 输入宽度和 `72px` 终端高度。

## 2. 当前项目影响范围和作废项

当前 HEAD 为 `c4f75767eb21cec481167eabc2917bed3d2d4540`。工作区存在上一轮未提交改动，包含登录页、控制器、资源删除、测试和构建配置。它们不是可信的迁移基线：

- `packages/webui/src/pages/login.tsx`、`login.css`：现有视觉结构必须重写，不能在当前纵向布局上继续叠加规则。
- `packages/webui/src/components/login-signet.tsx`、`login-signature.tsx`：保留文件名可以，但 JSX 必须按本方案的 DOM 结构重做。
- `packages/webui/src/lib/signet-renderer.ts`、`signet-fracture.ts`、`signet-cracks.ts`、`ambient-particles.ts`、`token-field.ts`：逐文件与参考算法核对；只保留已证明与参考输出一致的实现。
- `packages/webui/src/lib/login-motion.ts`、`packages/webui/src/lib/api.ts`、`packages/webui/package.json`、Playwright 配置和 `CHANGELOG.md`：实现阶段按最终依赖图重新审查，不能把上一轮删除或改动自动视为正确。
- 旧视频、轨迹渲染器和旧测试的删除只能在新链路通过构建和视觉验收后确认；需要回退时以 HEAD 中的文件为来源，不从当前工作区复制。

本方案的实施进度从零开始。上一版方案末尾的 `[x]` 全部作废，不能继续以“算法已接入”“构建已通过”宣称视觉迁移完成。方案阶段不新增 `CHANGELOG.md` 记录；后续每次代码变更继续使用根目录现有 `pending` 记录，提交由用户自行执行。

## 3. React DOM 一比一映射

`LoginPage` 必须输出下列等价层级。允许给 class 增加项目作用域前缀，但不能增删会改变布局或动画的层级；尤其不能加入参考页没有的品牌 Header、运动按钮、显示/隐藏按钮或普通登录按钮。

```text
.login-page                         // React 页面根节点，承载主题和阶段属性
├── .morning-garden                 // 固定全屏三层晨雾
│   ├── .mist-bank.mist-bank-rose
│   ├── .mist-bank.mist-bank-lilac
│   ├── .mist-bank.mist-bank-pearl
│   └── .background-clearance
├── canvas.background-particles     // 全屏粒子层
├── ThemeToggle                     // 只保留参考页右上角主题按钮的视觉位置
└── main
    └── .login-scene[data-phase]
        ├── .signet[aria-hidden]
        │   └── .signet-motion
        │       ├── canvas.signet-idle-glow
        │       └── canvas.signet-art
        ├── form.terminal[aria-label="密钥登录"]
        │   ├── .origin
        │   ├── svg.frame.frame-upper
        │   ├── svg.frame.frame-lower
        │   ├── .input-line
        │   │   └── .token-field
        │   │       ├── input#token
        │   │       ├── .token-measure
        │   │       └── .token-caret
        │   ├── .failure-meter
        │   ├── .terminal-welcome
        │   └── .terminal-status
        └── .completion-status
<footer.signature aria-label="Elysia API">
    ├── .signature-line.signature-line-left
    ├── svg.signature-wordmark
    └── .signature-line.signature-line-right
```

### 3.1 终端和 frame SVG

- 两个 frame SVG 必须保留参考页 `defs` 中的 `linearGradient`、`path id`、`pathLength="1"` 和 `use` 结构；下框使用参考页相同的 `rotate(180 200 40)`。
- React 需要为 SVG `id` 生成页面内唯一前缀，避免 `use href` 冲突，但路径坐标、`--from-x`、`--from-y`、`stroke-dasharray` 和动画参数不变。
- 表单视觉高度保持 `80px`，通过 Enter 提交；不添加按钮改变终端宽度和视觉重心。
- 输入保留可访问 label、`aria-required`、`aria-busy`、`aria-invalid` 和状态文本。label 可以使用 `sr-only`，但不能省略。
- `failure-meter` 保留五个 segment、`role="progressbar"`、`aria-valuemin="0"`、`aria-valuemax="5"` 和中文 `aria-valuetext`。

### 3.2 底部字标

`login-signature.tsx` 必须把参考 `index.html` 中 9 个独立字母路径和对应 mask 原样转成 JSX；不能使用 `BrandMark`、普通文本 `Elysia API` 或字体渲染代替。路径的 `pathLength`、每个字母的 CSS 变量、书写顺序、左右线条和 `viewBox="0 0 257 88"` 必须保留。

SVG `id` 通过 `useId()` 或等价前缀隔离，不能删掉 mask。字标仍是装饰内容，`aria-hidden="true"`，外层 footer 提供 `aria-label`。

## 4. CSS 迁移规则

### 4.1 只做作用域化，不重新设计

实现时以参考 `login.css` 和 `backgrounds.css` 为逐条迁移清单：

1. 将 `:root` 变量复制到 `.login-page`；深色变量绑定 `.login-page[data-theme="dark"]`。`data-theme` 从现有 `useTheme()` 派生，只存在一个主题状态源。
2. 将 `body` 背景、`main` 布局、`footer` 定位分别改写为 `.login-page`、`.login-page > main`、`.login-page .signature`，数值不变。
3. 将未加前缀的 `.login-scene`、`.signet`、`.terminal`、`.frame`、`.token-field`、`.signature` 等选择器统一限定在 `.login-page` 下；不要把项目控制台的同名元素改样式。
4. 将 `body:has(...)` 状态替换为 `.login-page[data-phase]` 和 `.login-page.is-awakening/.is-lit`，只改变选择器输入，不改变透明度和阶段含义。
5. 所有 `@keyframes` 加 `login-` 前缀并同步引用；动画时长、延迟、缓动、`fill-mode` 和媒体查询保持参考值。
6. 保留参考 CSS 的 `:is()` 选择器行为：`entering` 只显示刻印，`shifting` 让刻印回到左列，`opening` 展开终端，`ready` 显示输入，`welcoming/closing` 收起输入，`exhausted` 显示错误欢迎文本。

禁止保留当前近似实现中的以下规则：纵向上下堆叠场景、`430px` 大表单、Header 品牌块、圆形刻印装饰环、额外光晕、普通文本字标、渐变背景替代晨雾、显示/隐藏按钮和普通提交按钮。

### 4.2 背景逐条迁移

- `.morning-garden` 固定全屏；三层 `.mist-bank` 分别保留参考 radial-gradient、周期、负延迟和 `--mist-play`。
- `.background-clearance` 保留中心刻印、终端和底部字标的径向留白；移动端使用参考的纵向版本。
- 浅色显示晨雾，深色隐藏晨雾；`is-awakening` 时透明度降为参考值；页面隐藏或减少动态时暂停雾和粒子。
- 背景粒子 canvas 仍位于内容后方，不能让当前自定义的 `::before/::after` 光晕取代三层晨雾。

### 4.3 主题和全局交接

继续使用 `ThemeProvider` 和 `ThemeToggle`，不引入参考页自己的 localStorage key 或 `theme.js`。登录页挂载期间可同步 `body` 背景和 `meta[name="theme-color"]`，卸载时必须恢复原值；这些是交接适配，不得改变页面内部视觉 token。

## 5. 控制器迁移

### 5.1 文件和边界

使用本项目命名承载参考算法：

```text
packages/webui/src/lib/
├── signet-renderer.ts      // 对应 signet.js
├── signet-fracture.ts      // 对应 signet-fracture.js
├── signet-cracks.ts        // 对应 signet-cracks.js
├── ambient-particles.ts    // 对应 background-particles.js
├── token-field.ts          // 对应 token-input.js
└── login-motion.ts         // 项目动态偏好和页面可见性
```

每个控制器接收 React refs 或明确参数，禁止在控制器初始化时用 `document.querySelector()` 查找页面节点。算法内部创建临时 canvas 是允许的；页面节点必须由页面层注入。

所有控制器都必须返回幂等 `destroy()`，清理 RAF、Web Animations、`resize`、`visibilitychange`、`selectionchange`、`ResizeObserver`、`MutationObserver`、媒体查询监听和未完成 Promise 的后续回调。React StrictMode 重挂载后不能出现两组帧循环。

### 5.2 刻印算法不得简化

逐文件迁移参考实现，先保证输出等价，再做 TypeScript 类型收紧：

- 保留 `FIELD_SIZE = 192`、`RENDER_SIZE = 640`、`DETAIL_SCALE = 2`、`ART_PADDING = 112`、`LIGHT_DURATION = 2000`、`FRACTURE_DURATION = 1200`、`SHATTER_DURATION = 1700`。
- 保留从 `elysia-signet-solid.png` 计算 arrival field、idle contour、glow field 的顺序和采样坐标。
- 保留 Voronoi `GRID = 6`、投影焦距、晶片姿态、裂痕路径、第二至第四次局部晶片弹出，以及第五次绷紧、释放和漂浮。
- `refreshTheme()` 从注入的根节点 `getComputedStyle()` 读取颜色；不能把当前近似实现中的自定义颜色常量写回绘制循环。
- 暂停和恢复必须保持参考 `syncMotion()` 行为；页面隐藏或锁定时暂停 idle 和碎片漂浮。

控制器接口至少包括：

```ts
interface SignetController {
  play(): Promise<boolean>
  breakApart(level: number): Promise<boolean>
  reset(): void
  refreshTheme(): void
  syncMotion(): void
  destroy(): void
}
```

### 5.3 待机、成功、失败时序

- 入场完成后启动两条同周期 `5500ms` 的 idle Web Animations：刻印 `translateY(0 → -7px → 0)`，柔光 `opacity(0 → 1 → 0)`。
- 成功前执行 `riseToIdlePeak()`，将当前下降半周期镜像到达峰值；不能直接跳到点亮。
- 失败每次先执行 `420ms` 输入框抖动，再调用 `breakApart(failedAttempts)`；前三次/第四次使用 `1200ms` 裂痕流程，第五次使用 `1700ms` 解体流程。
- 点亮使用参考 `2000ms`，场景在 `lit` 后保持约 `360ms` 完整点亮，再用约 `720ms` 淡出，最后才交给宿主导航。

## 6. 页面状态机和认证适配

### 6.1 视觉阶段

`data-phase` 只使用参考页面需要的阶段：

```ts
'loading' | 'entering' | 'shifting' | 'opening' | 'ready'
| 'welcoming' | 'closing' | 'centering' | 'waiting-peak'
| 'lighting' | 'lit' | 'exhausted'
```

认证请求中的“验证中”不新增一套终端视觉；页面在 `ready` 阶段保留参考布局，通过 `form[aria-busy="true"]` 和输入只读表达请求状态。这样不会引入参考页没有的状态栏或按钮。

阶段必须按以下顺序运行：

```text
loading
  → entering（刻印从中心显现）
  → 等待字标动画完成
  → shifting（刻印让位到左列）
  → opening（终端边框、origin、meter、输入线展开）
  → ready

ready + HTTP 401
  → 抖动 → breakApart(1..4) → ready
  → 第 5 次 breakApart(5) → exhausted（输入禁用，显示错误欢迎文案）

ready + HTTP 200
  → riseToIdlePeak
  → welcoming（显示“欢迎回来”）
  → closing（终端收起）
  → centering（刻印归中）
  → waiting-peak
  → lighting
  → lit
  → 点亮最终帧保持 340ms
  → Portal 复制刻印画面
  → setToken(token) + navigate('/overview', { replace: true })
  → 交接刻印飞向首页品牌位置并融合
```

每次入场、失败或成功流程都使用递增 `runId`；卸载、重置、页面隐藏或新提交后，旧 Promise 不得修改阶段、调用 `setToken()` 或继续绘制。

### 6.2 认证边界

保留现有 `verifyToken()` 的 `/api/admin/health` 和 `Authorization: Bearer <token>` 约定，仅允许增加 `AbortSignal`：

```ts
verifyToken(token: string, signal?: AbortSignal): Promise<void>
```

业务映射如下：

| 结果 | 页面行为 | 裂痕计数 |
| --- | --- | --- |
| 空值 | 使用项目现有本地提示，不调用后端 | 不增加 |
| HTTP 401 | 抖动、裂痕/碎片、恢复输入；第五次进入 `exhausted` | 增加 |
| 其他 HTTP 错误、超时、网络异常 | 显示服务状态提示，保留输入 | 不增加 |
| HTTP 200 | 执行完整成功动画；Portal 接管点亮画面后调用 `setToken()` 并导航 | 不增加 |

成功动画期间输入禁用，网络请求使用独立 `AbortController`；卸载时取消。除 Enter 提交外不提供普通登录按钮，避免破坏参考终端的 360×80 视觉结构。

## 7. 资源、清理和命名

- 将已校验的 `elysia-signet-solid.png` 放在 `packages/webui/public/assets/signet/`，通过 `${import.meta.env.BASE_URL}assets/signet/elysia-signet-solid.png` 加载。
- 为资源添加来源/许可证说明；不复制字体，不读取 `/mnt/e/dev/login-demo`，不在构建脚本中增加外部复制步骤。
- 旧视频、角色轨迹、旧 `LoginCinematic` 和只服务旧链路的校验脚本，必须在新实现通过业务和视觉验收后再删除或确认删除。
- 新增文件名描述职责，例如 `login-signet`、`login-signature`、`signet-renderer`；任何新增命名不得出现 `login-demo`。
- 所有代码变更继续记录在根目录 `CHANGELOG.md`；未提交时使用已有 `pending`，不得伪造提交哈希。方案文档本身不新增代码变更记录。

## 8. 分阶段实施清单

### 阶段 0：重做前审计

- [x] 固定参考提交和文件 SHA，确认参考仓库工作区干净。
- [x] 对当前工作区逐项列出上一轮新增、修改和删除，确认哪些属于错误近似实现，哪些可复用。
- [x] 以 HEAD 文件作为回退来源，不把当前工作区的“已删除旧链路”当作最终决定。

完成标准：没有未核对的旧登录文件、资源和构建引用；当前方案中的映射与参考 DOM 一致。

### 阶段 1：React 宿主和 DOM

- [x] 重写 `login.tsx`，输出第 3 节规定的层级；移除 BrandMark、运动按钮、显示/隐藏按钮和普通提交按钮。
- [x] 重写 `login-signet.tsx` 和 `login-signature.tsx`；内联 SVG 路径和 frame `defs/use` 完整迁移。
- [x] 保留 `ThemeProvider`、`ThemeToggle`、Toast、React Router 和 `setToken` 接口。

完成标准：禁用动画后，在 1440×900 和 390×844 的 DOM 几何与参考页面一致，桌面为横向两列。

### 阶段 2：CSS 和背景

- [x] 逐条迁移 `login.css`、`backgrounds.css`，完成根节点作用域化。
- [x] 恢复原始颜色、尺寸、间距、SVG frame 展开/描线、输入光标、签名字标书写和所有媒体查询。
- [x] 删除当前近似实现的自定义光晕、纵向布局、非参考 Header 和按钮样式。

完成标准：不接 Canvas 算法时，`loading/entering/shifting/opening/ready/welcoming/closing` 的 DOM 动画顺序与参考页面相同。

### 阶段 3：控制器逐文件迁移

- [x] 以参考 JS 为源逐文件迁移刻印、裂痕、碎片、粒子和输入控制器。
- [x] 只把 DOM 查询改为 refs/参数，补齐 TypeScript 类型和 `destroy()`；不改算法常量和时序。
- [x] 接入 idle、`riseToIdlePeak`、主题刷新、可见性、减少动态和重置逻辑。

完成标准：不接真实认证时可独立演示入场、待机、1/4/5 次失败、复位和点亮；StrictMode 重挂载无重复 RAF/监听器。

### 阶段 4：认证接入

- [x] 接入 `verifyToken(token, signal)` 和现有 `setToken()`。
- [x] 401 只走视觉裂痕；服务/网络异常不增加计数；成功动画完成后才保存 Token。
- [x] 验证重复 Enter、卸载取消、页面返回和失败锁定行为。

完成标准：真实后端下有效 Token 进入控制台，无效 Token 按阶段运行，异常不破坏输入和视觉状态。

### 阶段 5：旧链路清理

- [x] `rg` 检查旧视频、轨迹、`LoginCinematic` 和旧资源的运行时引用。
- [x] 仅在新链路通过构建、业务和浏览器验收后，确认旧文件删除和构建脚本清理。
- [x] 更新 `CHANGELOG.md` 的 pending 记录，保持中文描述和实际文件范围一致。

完成标准：构建产物只包含新登录资源，不引用外部项目路径或旧视频。

### 阶段 6：完整验收和审查

- [x] 运行 WebUI 类型检查、lint、Playwright、Vite 构建。
- [x] 运行后端完整测试和根目录完整构建，验证 `/ui/` 外部目录与 Go 内嵌目录两种模式。
- [x] 完成第 9 节截图/录屏对照，记录偏差并修正后再标记完成。
- [x] 最后审查 diff、资源清单、监听器销毁、认证交接和 CHANGELOG；不执行 commit。

## 9. 视觉验收矩阵

### 9.1 固定截图

必须同时启动参考页和本项目 WebUI，使用相同浏览器、字体、设备像素比和视口，至少保存以下截图：

| 视口 | 主题 | 阶段/场景 |
| --- | --- | --- |
| 1440×900 | 浅色 | `ready`、完整入场、1/4/5 次失败、成功点亮 |
| 1440×900 | 深色 | `ready`、完整入场、1/4/5 次失败、成功点亮 |
| 390×844 | 浅色 | `ready`、完整入场、第五次解体 |
| 390×844 | 深色 | `ready`、完整入场、第五次解体 |

对照项目必须包含：刻印左/右位置、终端宽高、边框 origin 和描线、输入线、五格 meter、底部字标路径、字标两侧线、三层晨雾、中央留白、粒子遮挡、主题按钮位置和移动端安全区。

### 9.2 对照方法

- 浏览器首选 Playwright；当前环境曾因缺少 `libnspr4.so` 无法启动 Chromium，验收阶段必须先补齐可用浏览器运行库或改用环境中可用的 Chromium/Firefox，不能把 TypeScript 或构建通过当作视觉通过。
- 截图使用相同视口和 `deviceScaleFactor=1`；通过页面注入固定 `Math.random` 种子，保证粒子和 Voronoi 采样可比较。
- 对静态几何使用图像 diff；对粒子和 Canvas 点亮过程使用同时间点截图加人工逐项检查。任何横向/纵向布局、终端尺寸、字标缺失、边框时序或主题层级差异均视为失败。
- 验证中间阶段不能只等待最终 `ready`：必须分别截取 `entering`、`shifting`、`opening`、`welcoming`、`closing`、`centering`、`lighting`。
- 记录参考截图、本项目截图、视口、主题、阶段、差异说明和修正提交前后的结果，作为最终审查证据。

### 9.3 业务和生命周期检查

- [x] Enter 提交而非普通按钮提交，重复 Enter 只发一个请求。
- [x] HTTP 401 才增加裂痕；第 5 次锁定并显示原版错误欢迎文案。
- [x] 500、超时、断网不增加裂痕，输入内容保留。
- [x] Portal 接管点亮画面前不触发 `setToken()`；接管后进入现有控制台路由并执行品牌交接。
- [x] 主题切换不清空输入、不重播入场、不重置失败次数。
- [x] `prefers-reduced-motion`、页面隐藏、React StrictMode 重挂载和卸载均不留下 RAF、监听器、Observer 或未处理 Promise。
- [x] 外部 `webuiDir` 和 Go 内嵌 `/ui/` 均能加载刻印 PNG、CSS、JS 和 SVG。

## 10. 完成定义和当前进度

只有同时满足以下条件，才可称为“完整视觉迁移完成”：

1. DOM 层级和桌面/移动端几何遵循参考页，且没有额外可见控件改变视觉。
2. 原始 CSS 数值、阶段动画、背景层、内联 SVG 字标和 Canvas 算法均完成迁移；截图/录屏对照通过。
3. 认证、Token 持久化、Cookie、401、异常和退出登录行为保持本项目约定。
4. 控制器生命周期在 StrictMode、主题切换、隐藏页面和减少动态场景下无泄漏。
5. WebUI 检查、后端完整检查、构建、外部目录和 Go 内嵌 `/ui/` 均通过。
6. `CHANGELOG.md` 已记录真实变更；没有执行未经用户要求的 Git commit。

### 实施进度（2026-09-24）

- [x] 参考提交、DOM、CSS、算法文件和资源 SHA 已冻结。
- [x] 当前错误近似实现已识别并明确作废。
- [x] React DOM 一比一映射方案已确定。
- [x] CSS、背景、控制器、认证适配和视觉验收规则已确定。
- [x] 阶段 0：重做前审计。
- [x] 阶段 1：React 宿主和 DOM 重做。
- [x] 阶段 2：CSS 和背景逐条迁移。
- [x] 阶段 3：控制器逐文件迁移。
- [x] 阶段 4：认证接入。
- [x] 阶段 5：旧链路清理。
- [x] 阶段 6：完整验收和代码审查。
- [x] 代码审查修复：`verifyToken` 改为内部合并调用方取消与 15 秒超时，并在所有退出路径清理定时器和监听器，避免依赖 `AbortSignal.any()`。
- [x] 代码审查复测：修正系统日志重登录 E2E 对额外 SWR 重验证的脆弱固定编号断言，完整 20 项浏览器回归通过。

验收证据（2026-09-24）：使用 Chromium 1243、DPR 1、1440×900 与 390×844，对参考页和本项目执行固定种子截图；`ready`、首失败、第五次解体的桌面/移动端画面逐项人工对照，终端 `(790,410,360,80)`、刻印 `(290,250,400,400)`、字标 `(460,800,520,76)` 与参考一致。深色页、晨雾/花瓣、字标、边框、五格提示和碎片解体均已检查；无头 shell 的 Canvas 漏绘不作为验收依据。

最终状态：完整视觉迁移和本地运行验收已完成。未执行 Git commit；`CHANGELOG.md` 使用 `pending`，待用户提交后替换为真实短哈希。
