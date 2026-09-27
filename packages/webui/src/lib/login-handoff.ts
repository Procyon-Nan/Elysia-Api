export interface ContentBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface BackgroundLayerSnapshot {
  readonly background: string
  readonly opacity: string
  readonly transform: string
}

export interface BackgroundCanvasSnapshot {
  readonly canvas: HTMLCanvasElement
  readonly cssWidth: string
  readonly cssHeight: string
  readonly opacity: string
}

export interface BackgroundSnapshot {
  readonly root: string
  readonly garden: BackgroundLayerSnapshot
  readonly mistBanks: readonly [BackgroundLayerSnapshot, BackgroundLayerSnapshot, BackgroundLayerSnapshot]
  readonly clearance: BackgroundLayerSnapshot
  readonly particles: BackgroundCanvasSnapshot
}

export interface HandoffSource {
  readonly artwork: HTMLCanvasElement
  readonly idleGlow: HTMLCanvasElement
  readonly artworkRect: DOMRectReadOnly
  readonly contentBounds: ContentBounds
  readonly background: BackgroundSnapshot
}

export interface HandoffMotionSource {
  readonly artworkRect: DOMRectReadOnly
  readonly artworkWidth: number
  readonly artworkHeight: number
  readonly contentBounds: ContentBounds
  readonly background: BackgroundSnapshot
}

const BRAND_IMAGE_URL = `${import.meta.env.BASE_URL}logo-color.png`
// 手动调整入口：刻印从登录页实体位置飞向首页品牌位置的持续时间（毫秒）。
const FLIGHT_DURATION = 850
// 手动调整入口：到达目标后真实首页品牌图标与交接画面的融合时间（毫秒）。
const BLEND_DURATION = 160
const FLIGHT_KEYFRAMES = 33

let brandImagePromise: Promise<HTMLImageElement> | null = null

export function brandImageUrl(): string {
  return BRAND_IMAGE_URL
}

/** 交接开始前准备最终品牌图标；同一 Promise 供 BrandMark 和 Portal 复用。 */
export function prepareBrandImage(): Promise<HTMLImageElement> {
  if (brandImagePromise) return brandImagePromise
  const image = new Image()
  image.decoding = 'async'
  image.src = BRAND_IMAGE_URL
  brandImagePromise = image.decode().then(() => image).catch((error: unknown) => {
    brandImagePromise = null
    throw error
  })
  return brandImagePromise
}

export function readImageBounds(image: HTMLImageElement): ContentBounds {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('品牌图标尚未完成解码')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('无法创建品牌图标画布')
  context.drawImage(image, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height).data
  const bounds = { minX: width, minY: height, maxX: 0, maxY: 0 }
  for (let i = 0; i < width * height; i += 1) {
    if (pixels[i * 4 + 3] <= 31) continue
    bounds.minX = Math.min(bounds.minX, i % width)
    bounds.maxX = Math.max(bounds.maxX, i % width)
    bounds.minY = Math.min(bounds.minY, Math.floor(i / width))
    bounds.maxY = Math.max(bounds.maxY, Math.floor(i / width))
  }
  bounds.maxX += 1
  bounds.maxY += 1
  if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
    throw new Error('品牌图标没有可见实体')
  }
  return bounds
}

export function copyHandoffCanvas(source: HandoffSource): HTMLCanvasElement {
  if (source.artwork.width < 1 || source.artwork.height < 1 ||
      source.idleGlow.width !== source.artwork.width || source.idleGlow.height !== source.artwork.height) {
    throw new Error('刻印画布尚未完成渲染')
  }
  const snapshot = document.createElement('canvas')
  snapshot.width = source.artwork.width
  snapshot.height = source.artwork.height
  const context = snapshot.getContext('2d')
  if (!context) throw new Error('无法创建刻印交接画布')
  context.drawImage(source.idleGlow, 0, 0)
  context.drawImage(source.artwork, 0, 0)
  return snapshot
}

/** 复制登录页粒子画布，保留像素尺寸和当前 CSS 显示状态。 */
export function copyBackgroundCanvas(
  canvas: HTMLCanvasElement,
  style: Pick<CSSStyleDeclaration, 'width' | 'height' | 'opacity'>,
): BackgroundCanvasSnapshot {
  if (canvas.width < 1 || canvas.height < 1) {
    throw new Error('背景粒子画布尚未完成渲染')
  }
  const snapshot = document.createElement('canvas')
  snapshot.width = canvas.width
  snapshot.height = canvas.height
  const context = snapshot.getContext('2d')
  if (!context) throw new Error('无法创建背景粒子快照画布')
  context.drawImage(canvas, 0, 0)
  return {
    canvas: snapshot,
    cssWidth: style.width,
    cssHeight: style.height,
    opacity: style.opacity,
  }
}

function rectFromBounds(rect: DOMRectReadOnly, bounds: ContentBounds, width: number, height: number) {
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0 ||
      bounds.minX < 0 || bounds.minY < 0 || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
    throw new Error('刻印交接几何尚未准备完成')
  }
  const scaleX = rect.width / width
  const scaleY = rect.height / height
  return {
    left: rect.left + bounds.minX * scaleX,
    top: rect.top + bounds.minY * scaleY,
    width: (bounds.maxX - bounds.minX) * scaleX,
    height: (bounds.maxY - bounds.minY) * scaleY,
  }
}

export function createFlightKeyframes(
  source: HandoffMotionSource,
  targetRect: DOMRectReadOnly,
  targetBounds: ContentBounds,
  targetImageWidth: number,
  targetImageHeight: number,
  reducedMotion: boolean,
): Keyframe[] {
  const sourceBounds = rectFromBounds(source.artworkRect, source.contentBounds, source.artworkWidth, source.artworkHeight)
  const targetContent = rectFromBounds(targetRect, targetBounds, targetImageWidth, targetImageHeight)
  const scale = Math.min(targetContent.width / sourceBounds.width, targetContent.height / sourceBounds.height)
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('刻印交接缩放无效')
  const sourceCenterX = sourceBounds.left - source.artworkRect.left + sourceBounds.width / 2
  const sourceCenterY = sourceBounds.top - source.artworkRect.top + sourceBounds.height / 2
  const targetCenterX = targetContent.left + targetContent.width / 2
  const targetCenterY = targetContent.top + targetContent.height / 2
  const endX = targetCenterX - (source.artworkRect.left + sourceCenterX * scale)
  const endY = targetCenterY - (source.artworkRect.top + sourceCenterY * scale)
  const arc = Math.min(48, Math.hypot(endX, endY) * .04)
  const frames: Keyframe[] = []
  for (let index = 0; index < FLIGHT_KEYFRAMES; index += 1) {
    const raw = index / (FLIGHT_KEYFRAMES - 1)
    const t = reducedMotion ? 1 : raw
    const x = (1 - t) ** 2 * 0 + 2 * (1 - t) * t * (endX / 2) + t ** 2 * endX
    const y = (1 - t) ** 2 * 0 + 2 * (1 - t) * t * (endY / 2 - arc) + t ** 2 * endY
    const currentScale = 1 + (scale - 1) * t
    frames.push({ transform: `translate3d(${x}px, ${y}px, 0) scale(${currentScale})` })
  }
  return frames
}

export const HANDOFF_FLIGHT_DURATION = FLIGHT_DURATION
export const HANDOFF_BLEND_DURATION = BLEND_DURATION
