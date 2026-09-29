export interface ContentBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

// 登录刻印同时作为首页品牌图形；资源文件必须保持原始字节，不在运行时切换近似图形。
const BRAND_IMAGE_URL = `${import.meta.env.BASE_URL}assets/signet/elysia-signet-solid.png`

// 该阈值同时用于源 Canvas 和首页 Logo 的可见实体边界，避免飞行缩放使用两套口径。
export const BRAND_CONTENT_ALPHA_THRESHOLD = 31

// 由当前唯一品牌资源校验得到；替换资源时必须同步重新核对尺寸、SHA 和实体边界。
export const BRAND_ASSET_DIMENSIONS = {
  width: 3745,
  height: 3707,
} as const

export const BRAND_ASSET_CONTENT_BOUNDS = {
  minX: 402,
  minY: 443,
  maxX: 3289,
  maxY: 3270,
} as const

let brandImagePromise: Promise<HTMLImageElement> | null = null

function assertBrandImageDimensions(image: HTMLImageElement): void {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (width !== BRAND_ASSET_DIMENSIONS.width || height !== BRAND_ASSET_DIMENSIONS.height) {
    throw new Error('品牌图标尺寸与构建基线不一致')
  }
}

export function brandImageUrl(): string {
  return BRAND_IMAGE_URL
}

/** 交接开始前准备唯一品牌图形；BrandMark、登录渲染器和 Portal 复用浏览器缓存。 */
export function prepareBrandImage(signal?: AbortSignal): Promise<HTMLImageElement> {
  signal?.throwIfAborted()
  if (!brandImagePromise) {
    const image = new Image()
    image.decoding = 'async'
    image.src = BRAND_IMAGE_URL
    brandImagePromise = image.decode().then(() => {
      assertBrandImageDimensions(image)
      return image
    }).catch((error: unknown) => {
      brandImagePromise = null
      throw error
    })
  }
  return brandImagePromise.then((decoded) => {
    signal?.throwIfAborted()
    return decoded
  })
}

export function readImageBounds(image: HTMLImageElement): ContentBounds {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('品牌图标尚未完成解码')
  }
  assertBrandImageDimensions(image)
  // 资源字节和 alpha 边界由构建验收锁定；运行时不再扫描近 1400 万像素，避免交接首帧卡顿。
  return { ...BRAND_ASSET_CONTENT_BOUNDS }
}
