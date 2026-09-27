/**
 * 全站 z-index 梯度（tailwind 类名形式，集中命名防漂移）。
 * 层级从低到高：
 *   移动端导航 40 < 多选弹层 50 < Sheet 遮罩 60 < Sheet 面板 70 <
 *   Dialog 遮罩 74 < Dialog 面板 75 < 浮层(下拉/tooltip) 76 <
 *   Toast 90 < 跳转链接 100 < 登录交接层 110。
 * 登录交接层仅在一次性交接期间存在，用于覆盖 Provider 外部的通知和跳转链接。
 */
export const Z_INDEX = {
  mobileNavOverlay: 'z-40',
  mobileNavPanel: 'z-50',
  multiSelectPanel: 'z-50',
  sheetOverlay: 'z-[60]',
  sheetPanel: 'z-[70]',
  dialogOverlay: 'z-[74]',
  dialogPanel: 'z-[75]',
  floating: 'z-[76]',
  loginHandoff: 'z-[110]',
  toast: 'z-[90]',
  /** Recharts tooltip:高于内容、低于 Sheet/Dialog(不遮挡抽屉与弹窗)。 */
  chartTooltip: 'z-[50]',
  skipLink: 'z-[100]',
} as const

/** Recharts tooltip 的 inline zIndex(数字形态,JSX style 用):高于内容、
 * 低于 Sheet/Dialog,不遮挡抽屉与弹窗。 */
export const CHART_TOOLTIP_Z = 50
