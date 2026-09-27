# 登录刻印到首页品牌图标的衔接动画实施方案

## 0. 方案状态

- 日期：2026-09-26。
- 分支：`alter_main`。
- 当前阶段：实施完成，进入验证与审查。
- 本文只定义实现，不改变认证业务规则，不执行 Git commit。
- 本文接续 [登录页视觉迁移方案](webui-login-visual-replacement-plan.md)。上一轮登录页视觉、失败计数、裂痕、点亮算法和认证接口继续有效；旧的首页到达残影方案由本文替代。

目标：有效令牌认证成功后，登录页中央刻印完成归中和点亮，保持完整点亮状态，再连续缩小并移动到首页左上角的品牌刻印位置，最终与首页现有品牌图标融合为同一个图标。首页外壳和角色水印在飞行过程中显现，用户不应看到路由卸载造成的空白、双影或突兀跳变。

## 1. 已确认的决策

| 编号 | 决策 |
| --- | --- |
| Q1 | 由全局 Portal 承载独立 Canvas，使用 FLIP 几何变换，末尾与首页 `logo-color.png` 融合。 |
| Q2 | 交接层接管点亮画面后立即提交 Token，首页挂载与飞行并行。 |
| Q3 | 移动端不打开侧栏，刻印朝左上角虚拟品牌位置飞行并在那里淡出。 |
| Q4 | `prefers-reduced-motion` 下取消飞行、粒子和辉光，只保留即时静态交接。 |
| Q5 | 点亮阶段开始后锁定主题切换，交接完成后恢复。 |
| Q6 | 页面隐藏暂停；认证已提交时恢复或收束到首页，认证未提交时取消并留在登录页。 |
| Q7 | 交接状态只存在当前页面内存，不使用 `sessionStorage`，刷新和普通路由跳转不重播。 |
| Q8 | 首页在交接层下立即挂载，外壳、数据内容和右侧角色水印随飞行显现。 |
| Q9 | 飞行使用约 850ms 的轻微弧线，等比缩放并减速；到达后约 160ms 融合。 |
| Q10 | 首页数据请求按原有 hooks 立即启动，与交接并行，不等待数据返回。 |
| Q11 | 保留 `logo-color.png`、品牌文字和 `BrandMark` 布局，作为最终图标。 |
| Q12 | 飞行期间屏蔽首页交互并表达 `aria-busy`，完成后恢复。 |
| Q13 | 完成后聚焦 `main#main-content`，不打开移动抽屉。 |
| Q14 | 点亮画面复制到独立 Canvas，不移动登录页 React Canvas，不导出 Data URL/Blob。 |
| Q15 | Overview 不等待目标 DOM；终点由共享品牌几何规则直接计算。 |
| Q16 | 删除旧 `ArrivalEcho`、`app-fade`、到达标记和重复水印入场动画。 |
| Q17 | 点亮最终帧后保持约 340ms，再开始飞行。 |
| Q18 | 通过预分配、同步复制和资源准备消除可避免的快照失败；不设计动画失败后静默跳页。 |
| Q19 | 使用常驻 `LoginHandoffProvider` 管理一次性交接。 |
| Q20 | 交接层显式 `navigate('/overview', { replace: true })`。 |
| Q21 | 全局 Canvas 同步 `drawImage()` 复制主画布和柔光画布。 |
| Q22 | 品牌内边距、图标尺寸、文字行高使用共享 CSS 几何变量；不维护独立硬编码坐标。 |
| Q23/Q24 | 已核查懒加载风险；Overview 改为静态 import，不再预加载或等待独立 Overview chunk。 |
| Q25 | 选择静态 import，从架构上消除交接时 Overview chunk 未准备好的状态。 |
| Q26 | 登录页通过 `useLoginHandoff()` 调用交接层，不直接操作路由。 |
| Q27 | 移动端虚拟终点沿用桌面品牌几何：视口左上角 22px 内边距、34px 图标盒子。 |
| Q28 | Overview 静态 import 后，不再有 Overview 预加载网络策略；网络限制只影响首页数据请求。 |
| Q29 | 应用启动时预加载并解码 `logo-color.png`，交接复用同一资源；过快提交时在点亮状态等待图片准备。 |
| Q30 | 接受静态 import 增加初始脚本体积，以换取交接确定性；其他页面继续懒加载。 |

Q31 被排除：`logo-color.png` 缺失或部署路径错误属于构建/发布验收失败，不属于交接动画运行时设计。实现阶段必须通过资源清单、产物路径和 `/ui/` 加载检查发现并修复，不添加运行时替代图标或空白降级。

## 2. 当前代码事实

### 2.1 认证、路由和懒加载

- `App.tsx` 通过 `getToken()` 和 `subscribeToken()` 控制登录态。
- 当前 `OverviewPage` 使用 `React.lazy(() => import('./pages/overview'))`，只在 Token 分支首次渲染时加载。
- 当前 `usePreloadRoutes()` 只在已有 Token 后空闲预取调用日志和模型源，不能解决 Overview 首次加载。
- 当前 `AppLayout`、`OverviewPage` 和品牌侧栏会在 Token 改变后挂载；登录页卸载时现有 Canvas 会被 `destroy()` 清空。
- 当前生产产物的 `overview-*.js` 约 35.6KB 未压缩，入口只预加载 React/SWR/vendor 和 Recharts；这是首页骨架屏可能出现的直接原因。

### 2.2 视觉载体

- 登录刻印由 `signet-renderer.ts` 输出 640×640 主 Canvas 和柔光 Canvas。
- 登录 Canvas 的 DOM 通过 `.signet-art` 外扩到 135%，不能直接把 `.signet` 盒子当作实体图案边界。
- 首页 `BrandMark` 使用 `logo-color.png`，原始尺寸 128×125，当前显示高度 34px；品牌区横向和纵向内边距为 22px。
- 首页水印由 `ElysiaStage` 使用 `role-mask.png` 渲染，当前到达动画通过 `sessionStorage`、`ArrivalEcho` 和 `elysia-arrive` 组合实现。

## 3. 最终用户流程

```text
ready
  → Enter → verifyToken(token)
  → welcoming / closing / centering / waiting-peak
  → lighting → signet.play() 完成
  → 保持完整点亮 340ms
  → handoff.begin(source)
  → 同步复制 Canvas，设置全局交接层第一帧
  → setToken(token) + navigate('/overview', { replace: true })
  → 首页挂载、数据请求启动、外壳显现
  → 850ms 刻印弧线飞行
  → 160ms 桌面图标融合 / 移动端虚拟终点淡出
  → 移除交接层、解除 inert、恢复主题切换、聚焦 main
```

认证成功前不得写入 Token。交接层拿到有效 source 后才允许提交 Token；登录页不得在 Canvas 尚未接管时卸载。

## 4. 组件边界和接口

新增：

- `packages/webui/src/components/login-handoff.tsx`：常驻 Provider、Portal、独立 Canvas、屏蔽层和任务清理。
- `packages/webui/src/components/login-handoff.css`：交接背景、飞行载体、融合和首页显现样式。
- `packages/webui/src/lib/login-handoff.ts`：交接类型、实体边界映射、曲线关键帧和资源 Promise。

`LoginHandoffProvider` 位于 `HashRouter` 内、认证路由和页面 Suspense 外，提供：

```ts
interface LoginHandoffContextValue {
  active: boolean
  stage: 'idle' | 'flying' | 'blending'
  prepareAndNavigate(token: string, source: HandoffSource): Promise<void>
}
```

`HandoffSource` 至少包含：

```ts
interface HandoffSource {
  artwork: HTMLCanvasElement
  idleGlow: HTMLCanvasElement
  artworkRect: DOMRectReadOnly
  contentBounds: { minX: number; minY: number; maxX: number; maxY: number }
  background: string
}
```

接管时同步复制像素和矩形，不保存登录页 Canvas 的后续引用。Canvas 复制完成后，登录页才销毁自己的控制器。

## 5. 必须修改的现有文件

### `App.tsx`

1. 将 `OverviewPage` 改为静态 import，删除其 `lazy` 声明。
2. 保留其他页面的懒加载和现有 Suspense。
3. 在 `HashRouter` 内挂载 `LoginHandoffProvider`。
4. 交接层通过 `useNavigate()` 显式替换到 `/overview`。
5. 交接完成后聚焦 `main#main-content`。
6. 删除 `sessionStorage` 到达标记相关逻辑。

### `login.tsx`

- 通过 `useLoginHandoff()` 触发成功交接。
- 保留现有请求取消、`runId`、401 裂痕和异常处理。
- 删除点亮后的 720ms 场景整体淡出及“淡出结束后 setToken”的旧路径。
- 点亮完成后保持 340ms，构造 source，交给 Provider。
- Provider 接管成功后登录组件才能完成自身清理。

### 品牌和首页文件

修改 `brand-mark.tsx`、`sidebar.tsx`、`app-layout.tsx`、`role-watermark.tsx`、`theme-toggle.tsx` 和 `index.css`：

- 为品牌内边距、图标尺寸、品牌行高建立共享 CSS 变量。
- `BrandMark` 设置明确图片尺寸、`decoding` 和可控透明度；移除未使用的登录专用变体。
- 首页根布局在飞行期间设置 `inert`、`aria-busy="true"`；Portal 屏蔽鼠标和触摸。
- 主题按钮在点亮阶段和交接期间 disabled；完成后恢复。
- 水印随首页外壳显现，删除旧 `ArrivalEcho`、到达状态和重复水印入场动画。
- 删除 `ARRIVED_FROM_LOGIN_KEY`、`readArrivedFromLogin()`、`app-fade`、`watermark-settle` 等仅服务旧到达流程的代码。
- 保留首页正常角色水印、光环、`page-enter` 的 fixed 水印保护和普通路由切页样式。

## 6. 资源和几何

### 6.1 `logo-color.png` 资源

应用启动阶段由交接资源模块缓存同源 URL 和解码 Promise：

- 只创建一个 `Image` 实例和一个 Promise。
- `BrandMark` 使用相同 URL，复用浏览器缓存。
- 过快提交时，点亮状态保持到图片已解码；不在首页显示未准备好的目标图标。
- 不使用备用图标、临时占位图或另一张近似资源。

### 6.2 品牌终点

统一使用 CSS 变量和布局公式：

```text
brandInsetX = 22px
brandInsetY = 22px
logoHeight = 34px
logoWidth = 34px × 128 / 125
brandRowHeight = max(34px, 品牌文字两行的实际行高)
logoTop = brandInsetY + (brandRowHeight - logoHeight) / 2
```

桌面端目标为侧栏左上品牌图标实体中心；移动端目标为视口左上相同规则产生的虚拟实体中心。目标不依赖 Overview DOM 出现，不轮询、不等待 MutationObserver、不使用独立硬编码坐标。

### 6.3 源、目标实体边界

- 起点取归中后 `.signet-art` 的实际视口矩形。
- `signet-renderer.ts` 用已有 `solidAlpha()` 结果计算一次实体边界，阈值固定为 0.12。
- 源 Canvas 的透明留白和外围泛光继续保留；等比缩放以实体中心和实体尺寸计算。
- `logo-color.png` 解码时按 alpha > 0.12 计算一次实体边界；交接期间不读取图片像素。
- 最终 160ms 使用真实 PNG 图标融合，不承诺不同素材只靠缩放逐像素相同。

## 7. 动画和生命周期

### 7.1 飞行

- 点亮最终帧后静止 340ms。
- 飞行 850ms，使用项目已有 `cubic-bezier(0.2, 0.8, 0.2, 1)`。
- 源实体中心为 `P0`，目标实体中心为 `P2`；控制点为两端中点向上偏移 `min(48px, 两端距离 × 0.04)`。
- 不旋转、不弹跳、不回弹、不增加拖尾。
- 生成固定数量的 WAAPI 关键帧；逐帧不读取 DOM，不改变 Canvas 宽高。
- 到达后固定最终 transform，再启动 160ms 融合；先恢复真实图标，再移除 Portal，避免闪回。

### 7.2 首页显现和交互

- 首页外壳只做 opacity 动画，不使用 transform/filter。
- 水印随外壳显现，不再播放旧的 4 秒到达动画。
- 飞行期间首页根布局设置 `inert` 和 `aria-busy`，完成时先解除，再聚焦 main。
- 数据请求在首页挂载后立即启动，与飞行并行。

### 7.3 中断

| 事件 | 行为 |
| --- | --- |
| 页面隐藏/恢复 | 暂停/继续保持、飞行和融合，重置时间基准，不按隐藏时长跳帧。 |
| 提交 Token 前刷新或离开 | 取消认证和交接，保持未登录。 |
| 提交 Token 后刷新 | 取消临时层但保留 Token；重新加载直接进首页，不重播。 |
| 后退或 hash 离开 | 幂等取消临时层，恢复图标和交互，不覆盖用户导航。 |
| Token 被清除或首页 401 | 取消交接；旧 Promise 不得再次提交 Token。 |
| resize/旋转 | 读取当前呈现矩形续接，按剩余时间重新计算目标；跨 760/761px 切换融合或淡出。 |
| StrictMode 重建 | 递增 generation，取消旧 Animation、RAF、监听和回调；不得重复提交认证。 |
| reduced-motion | 提交静态最终状态，跳过飞行和非必要等待，释放锁并聚焦首页。 |

## 8. 实施阶段与进度

### 阶段 0：方案和基线

- [x] 读取两张截图，确认目标是大型刻印变为首页左上角小刻印。
- [x] 核对路由、Canvas 渲染器、品牌图标、懒加载和旧到达动画。
- [x] Q1–Q30 已确认并吸收移动端、静态 Overview、图片预解码和 Portal 交接要求。
- [x] 排除 Q31：资源缺失属于发布验收错误，不作为运行时产品分支。
- [x] 用户确认本文整体方案。

### 阶段 1：资源和路由

- [x] Overview 改为静态 import，建立 `logo-color.png` 解码 Promise 和实体边界缓存。
- [x] 抽取品牌几何变量，核对桌面、移动和大字号布局。

### 阶段 2：交接宿主

- [x] 新增 Provider、Portal、独立 Canvas、背景承接层和交互屏蔽层。
- [x] 接入登录 source，同步复制 Canvas 后再提交 Token 和导航。
- [x] 实现 generation、取消、隐藏/恢复、resize 和 StrictMode 清理。

### 阶段 3：飞行和融合

- [x] 实现实体边界对齐、850ms 弧线飞行和等比缩放。
- [x] 实现桌面 160ms 真实图标融合和移动端虚拟终点淡出。
- [x] 接入首页显现、水印同步、主题锁、inert 和最终焦点。

### 阶段 4：旧链路清理

- [x] 删除旧到达标记、ArrivalEcho 和重复水印动画。
- [x] 更新上一轮方案的成功路径说明，指向本文。
- [x] 在 `CHANGELOG.md` 增加本轮中文 `pending` 记录。

### 阶段 5：验证和审查

- [x] 运行 WebUI 类型检查、lint 和构建；类型检查由 WebUI build 覆盖。
- [ ] 运行现有 E2E（当前环境 Chromium 缺少 `libnspr4.so`，测试未进入浏览器启动后的页面阶段）。
- [ ] 补充跨路由交接、快速提交、图片预解码、移动端、刷新、隐藏/恢复和 reduced-motion 验证。
- [x] 检查 Overview 静态依赖、logo/signet/role-mask 资源路径和 `/ui/` 产物路径。
- [x] 按 review-code 技能审查实现，修复生命周期、路由和资源所有权问题。
- [ ] 记录关键中间帧并进行用户视觉验收。

验证限制：根目录 `npm run build` 已完成 WebUI 构建和资源同步，但在交叉编译阶段因当前 WSL 环境没有 `go` 命令退出；浏览器 E2E 因 Chromium 启动依赖缺少 `libnspr4.so` 未进入页面测试。

## 9. 验证矩阵

- 点亮和 340ms 保持期间 localStorage、Cookie 均无 Token。
- Canvas 接管后 Token/Cookie 写入，路由为 `#/overview`。
- Overview 不再发起独立 `overview-*.js` 懒加载请求。
- 飞行期间真实品牌图片不显示重复图标；完成后 Portal 消失且真实图标完整显示。
- 首页数据请求与飞行并行；移动端抽屉保持关闭。
- 完成后 main 获得焦点，`inert` 和 `aria-busy` 清除。
- 页面隐藏、恢复、刷新、后退、401、resize、StrictMode 和 reduced-motion 不留下动画、监听器或锁。
- 既有 401 裂痕、第五次锁定、异常不计数、重复 Enter 和退出登录行为继续通过。

视觉覆盖 1440×900 浅/深色、2560×1440、390×844、760/761px 边界、DPR 2、运行中 resize 和 reduced-motion；记录点亮、接管、飞行 25%/50%/75%、到达、融合和完成帧。通过条件是无空白、双影、亮度突变、拉伸、位置跳变或重复水印。

## 10. 实施后命令

```bash
cd /mnt/e/dev/elysia-api
npm run lint --workspace @root/webui
npm run build:webui
npm run test:e2e --workspace @root/webui
git diff --check
```

WebUI 通过后再执行根目录完整构建，并验证外部 `webuiDir` 和 Go 内嵌 `/ui/` 两种模式的资源路径。所有验证完成后才更新进度和准备提交命令；不代用户执行 `git commit`。
