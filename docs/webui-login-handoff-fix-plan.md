# 登录刻印交接动画专项修复方案

## 0. 方案状态

- 日期：2026-09-27。
- 分支：`alter_main`。
- 当前阶段：实现完成，静态复审完成，等待浏览器环境可用后进行视觉验收。
- 本文只处理交接动画的第 3、4、5、6 项问题，不改变认证规则、路由契约和失败次数机制。
- 本文不处理已撤回的两项审查结论：资源缺失运行时降级、交接期间主动 resize 续接。
- 本轮只新增方案文件，不修改实现，不执行 Git commit。

## 1. 核查结论

### 1.0 与原审查编号的对应关系

本专项沿用原审查中的编号，避免把已撤回的两项与本轮范围混淆：

| 原审查编号 | 本专项标题 | 是否处理 |
| --- | --- | --- |
| 3 | 移动端抵达后没有淡出 | 处理 |
| 4 | 飞行时长与首页显现时长不一致 | 处理 |
| 5 | 交接层级低于 Toast | 处理 |
| 6 | Portal 未承接登录页完整背景 | 处理 |

原审查第 1、2 项（资源失败运行时降级、交接期间主动 resize 续接）已按用户意见排除，不在本轮代码或验收范围内。

### 1.1 移动端没有淡出

当前 `login-handoff.css` 在 `max-width: 760px` 下把 `.login-handoff-target` 固定为 `opacity: 0 !important`。融合阶段实际仍只对目标图片执行 WAAPI opacity 动画，飞行 Canvas 保持完全不透明；`finishHandoff()` 在融合动画结束后直接移除 Portal。因此移动端刻印到达左上角后会突然消失，不符合已经确认的 Q3“到达虚拟位置后淡出”。

### 1.2 飞行时长与首页显现时长存在两个来源

当前 `packages/webui/src/lib/login-handoff.ts` 的 `FLIGHT_DURATION` 为 `1000ms`，而 `login-handoff.css` 的 `--login-handoff-duration` 为 `850ms`。首页外壳和 Portal 背景会比 Canvas 飞行提前结束，且后续手动调整其中一个值会再次产生不同步。既定方案的目标值为飞行 `850ms`、融合 `160ms`。

### 1.3 交接层低于 Toast

`Z_INDEX.loginHandoff` 为 `80`，Toast viewport 为 `90`，且 ToastHost 位于 LoginHandoffProvider 外部。已有 Toast 在退出登录后仍可能处于显示周期内；此时交接层的 shield 无法覆盖 Toast 的视觉和关闭按钮，交接期间的完整交互屏蔽契约不成立。

### 1.4 Portal 只承接根背景，未承接登录页可见背景层

Portal 当前只读取 `.login-page` 根节点的 `background`。登录页实际还显示独立的 `morning-garden`、三层 `mist-bank`、`background-clearance` 和 `background-particles`。登录页在 Token 提交后卸载，这些层随 DOM 一起消失；Portal 的背景层无法保持登录页最后一帧的完整背景，存在背景由薄雾场景突然变为纯根渐变的跳变。

## 2. 修复目标和边界

### 2.1 目标

1. 桌面端继续使用真实 `logo-color.png` 与飞行 Canvas 的 `160ms` 融合。
2. 移动端在虚拟左上角位置对飞行 Canvas 执行同一融合时段的平滑淡出。
3. 飞行、首页外壳/背景淡入以及手动可调时长使用同一权威值。
4. 交接 Portal 高于所有应用内通知和弹层，交接期间不出现可操作浮层。
5. 登录页卸载后，Portal 继续呈现登录页交接开始时的完整可见背景，直到飞行背景淡出完成。

### 2.2 不改变的内容

- 不为刻印资源缺失增加登录兜底。资源缺失属于构建/发布验收失败。
- 不为极低概率的用户主动 resize 增加新的快照或状态层。
- 不改变 Token 写入时机、`navigate('/overview', { replace: true })`、首页 `inert`、最终焦点和页面隐藏暂停语义。
- 不引入 `sessionStorage`、Data URL、Blob 或运行时备用图标。

## 3. 实施方案

### 3.1 移动端淡出

涉及文件：

- `packages/webui/src/components/login-handoff.tsx`
- `packages/webui/src/components/login-handoff.css`

实施步骤：

1. 保留移动端隐藏真实目标图片的规则，因为移动端不挂载常驻侧栏品牌图标。
2. 在融合阶段读取一次 `(max-width: 760px)` 媒体状态。
3. 桌面端继续对目标图片执行 `opacity: 0 → 1`；移动端改为对飞行 Canvas 执行 `opacity: 1 → 0`。
4. 两种路径都使用 `HANDOFF_BLEND_DURATION`，并把实际动画放进 `animationsRef`，保证页面隐藏时暂停、取消时释放、reduced-motion 时立即完成。
5. `finishHandoff()` 仍由融合动画的 `finished` Promise 驱动，确保 Canvas 淡出完成后才卸载 Portal。
6. 添加移动端验收点：飞行到虚拟位置后，刻印在融合时段连续变透明，不出现瞬间消失或重新出现在中心。

### 3.2 统一飞行与页面显现时长

涉及文件：

- `packages/webui/src/lib/login-handoff.ts`
- `packages/webui/src/components/login-handoff.tsx`
- `packages/webui/src/components/app-layout.tsx`
- `packages/webui/src/components/login-handoff.css`

实施步骤：

1. 将 `FLIGHT_DURATION` 固定为方案值 `850ms`；`BLEND_DURATION` 保持 `160ms`。这两个 TypeScript 常量是唯一手动调整入口。
2. Provider 在常驻生命周期内向 `document.documentElement` 注入 `--login-handoff-flight-duration` 和 `--login-handoff-blend-duration`；Portal 根节点和首页根布局都继承同一组值。
3. `login-handoff.css` 的背景淡出和 `.login-handoff-home` 外壳淡入读取 `--login-handoff-flight-duration`，融合动画读取 `--login-handoff-blend-duration`，不再维护与 TypeScript 分离的运行时数字。
4. CSS 只保留与方案值一致的静态初始值，作为样式加载顺序的安全值；交接开始时由 Provider 写入权威值，交接结束、取消或卸载时恢复注入前的变量值并清理自定义属性。
5. 方案和代码注释明确标出唯一手动调整位置：`packages/webui/src/lib/login-handoff.ts` 的 `FLIGHT_DURATION`、`BLEND_DURATION`；CSS 中只允许修改对应变量的 fallback，不得另行改时长。
6. 验收记录飞行 `0%/50%/100%`、首页外壳透明度和背景淡出，确认三者使用同一时间轴；修改 TypeScript 常量后不需要再改 CSS 数字。

### 3.3 提升交接层级并覆盖 Toast

涉及文件：

- `packages/webui/src/lib/z-index.ts`
- `packages/webui/src/components/login-handoff.tsx`
- `packages/webui/src/components/login-handoff.css`

实施步骤：

1. 将 `Z_INDEX.loginHandoff` 提升到高于 Toast 和 skip link 的专用层级，例如 `z-[110]`。
2. 更新 z-index 梯度注释，明确交接层只在 active 期间存在，完成后立即卸载，不改变正常页面的浮层顺序。
3. 保留首页根布局的 `inert` 和 Portal shield；提升层级只解决 Provider 外部 Toast 等 DOM 的覆盖问题，不替代可访问性锁定。
4. 不修改 ToastHost 的业务接口，不清空已有通知；交接期间通知可以继续存在，但必须位于交接层下方且不可点击。
5. 验收时保留一个未过期 Toast 再触发登录交接，检查 Toast 不覆盖刻印、不接收点击，交接完成后 Toast 恢复正常层级。

### 3.4 承接登录页完整背景

涉及文件：

- `packages/webui/src/pages/login.tsx`
- `packages/webui/src/lib/login-handoff.ts`
- `packages/webui/src/components/login-handoff.tsx`
- `packages/webui/src/components/login-handoff.css`

设计原则：只复制已经建立的可视状态，不保留登录页 DOM 引用，不重新启动登录页动画。

实施步骤：

1. 将登录页背景节点拆成可捕获的快照输入：根 `background`、`morning-garden` 的 `background`/`opacity`、三层 `mist-bank` 的 `background`/`opacity`/`transform`/`animation` 计算结果、`background-clearance` 的 `background`，以及 `background-particles` 当前 Canvas 像素/尺寸/透明度。
2. 为 `morning-garden`、三层薄雾、clearance 和粒子 Canvas 增加稳定 ref；在交接接管前读取 computed style，复制明确字段和数值，不把这些 DOM 引用放入交接状态。快照结构固定为不可变值对象，字段不直接暴露 `CSSStyleDeclaration` 或页面节点。
3. 使用 `drawImage()` 将粒子 Canvas 复制为独立 Canvas，同时保留原 Canvas 的像素尺寸和 CSS 显示尺寸；不使用 Data URL、Blob、DOM 截图 API 或重新启动粒子控制器。
4. 将 `HandoffSource.background` 扩展为 `BackgroundSnapshot`：根渐变 → garden → mist 层 → clearance → 粒子 Canvas。Portal 使用独立的背景层重建登录页最后一帧，背景层与首页外壳共享 `--login-handoff-flight-duration` 的显现/淡出时间轴。
5. Portal 背景快照的层级固定在飞行 Canvas 之下、目标图标和 shield 之下；背景层 `pointer-events: none`，不承接事件，也不读取登录页 DOM 的实时状态。
6. LoginPage 卸载后，Provider 只持有快照 Canvas、不可变样式字符串和数值；交接完成、取消、页面隐藏和路由离开时由 Provider 统一释放 Portal、快照 Canvas 引用、CSS 变量和动画。不得在 cleanup 中再次访问已卸载的登录节点。
7. 验收浅色/深色、桌面/移动端以及点亮时薄雾透明度变化，确认登录页卸载瞬间背景不变平、不闪白、不出现粒子残留跳变；在 `is-awakening` 和 `is-lit` 两个实际阶段分别捕获一次，确保透明度取自接管瞬间。

## 4. 文件修改清单

| 文件 | 变更 |
| --- | --- |
| `packages/webui/src/lib/login-handoff.ts` | 统一时长常量；增加背景快照类型和 Canvas 复制辅助函数。 |
| `packages/webui/src/components/login-handoff.tsx` | 移动端 Canvas 淡出、融合动画统一管理、CSS 时长注入、背景快照 Portal 渲染。 |
| `packages/webui/src/components/login-handoff.css` | 使用统一时长变量、补充背景快照层样式、移除移动端仅隐藏而无淡出的路径。 |
| `packages/webui/src/components/app-layout.tsx` | 让首页外壳读取 Provider 注入的统一飞行时长。 |
| `packages/webui/src/lib/z-index.ts` | 提升交接层级并更新全站层级说明。 |
| `packages/webui/src/pages/login.tsx` | 提供背景层 refs，在交接接管前构造不可变背景快照。 |
| `CHANGELOG.md` | 代码实施完成后增加本轮 pending 记录。 |
| 本方案文件 | 实时记录实施进度和验证状态。 |

## 5. 验收矩阵

- [ ] 桌面浅色：850ms 飞行期间首页外壳和背景与 Canvas 同步显现，160ms 真实图标融合无双影。
- [ ] 桌面深色：根背景、角色水印和品牌图标无闪白、无主题跳变。
- [ ] 移动端浅色/深色：Canvas 抵达虚拟左上角后在 160ms 内连续淡出，未出现瞬间消失。
- [ ] 已存在 Toast：Toast 位于交接层下方，不可见于交接层之上，也不可在交接期间点击。
- [ ] 登录页卸载瞬间：garden、薄雾、clearance、粒子和根背景连续。
- [ ] reduced-motion：移动端和桌面端均立即到最终状态，Portal 正常释放并聚焦首页。
- [ ] 页面隐藏/恢复：背景层、Canvas 飞行和融合动画一起暂停/恢复。
- [ ] 取消/路由离开：Portal、背景快照 Canvas、CSS 变量和动画全部释放。
- [ ] `npm run lint --workspace @root/webui` 通过。
- [ ] `npm run build --workspace @root/webui` 通过。
- [ ] `git diff --check` 通过。
- [ ] 浏览器 E2E 和真实视觉验收；当前环境需先解决 Chromium 缺少 `libnspr4.so` 的问题。

## 6. 进度

### 阶段 0：核查和方案

- [x] 核对移动端融合路径，确认当前没有 Canvas 淡出。
- [x] 核对 TypeScript/CSS 时长来源，确认当前为 `1000ms` 与 `850ms` 两套值。
- [x] 核对 ToastHost 所在层级，确认交接层低于 Toast。
- [x] 核对登录页背景 DOM，确认 Portal 当前只承接根 `background`。
- [x] 根据用户反馈排除资源失败降级和 resize 续接两项审查建议。
- [x] 写入本专项修复方案。

### 阶段 1：移动端和时序

- [x] 实现移动端 Canvas 淡出。
- [x] 统一飞行/融合/首页显现时长来源。
- [x] 补充对应注释和手动调整位置。

### 阶段 2：层级和背景

- [x] 提升交接层级并更新 z-index 说明。
- [x] 实现登录页完整背景快照和 Portal 重建。
- [x] 检查取消、隐藏、reduced-motion 和 StrictMode 清理。

### 阶段 3：验证

- [x] 运行 lint、WebUI build 和 diff check。
- [ ] 在可用浏览器环境执行 E2E；当前 20 项均在 Chromium 启动阶段因缺少 `libnspr4.so` 退出，未进入页面断言。
- [ ] 完成桌面/移动、浅色/深色和关键中间帧视觉验收；需浏览器环境可用。
- [x] 完成方案进度更新；提交仍由用户控制。

### 阶段 4：实现后复审

- [x] 按 `review-code` 技能检查职责、状态所有权、动画/Canvas 生命周期、CSS 时长来源、层级和错误路径。
- [x] 未发现具有较高维护价值的新问题；已修正 Dialog 层级注释与交接中途切换 reduced-motion 的收束时序。
