import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * 主题切换钮（侧栏底部 / 登录页右上角复用）。
 * 日/月 morph 移植自 toggles.dev「Classic」；原实现依赖 Tailwind v4 工具类，
 * 项目停在 v3，形变逻辑因此落在 index.css 的 .theme-sun 下。
 */
const SUN_RAYS = [
  'M12 1.4 12 3.8',
  'M20.3 3.7 17.8 6.2',
  'M22.6 12 20.2 12',
  'M12 22.6 12 20.2',
  'M1.4 12 3.8 12',
  'M20.3 20.3 17.8 17.8',
  'M3.7 20.3 6.2 17.8',
  'M3.7 3.7 6.2 6.2',
] as const

export function ThemeToggle({
  tooltip = false,
  variant = 'default',
  disabled = false,
}: { tooltip?: boolean; variant?: 'default' | 'login'; disabled?: boolean } = {}) {
  const clipId = useId()
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const [switching, setSwitching] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const handleClick = () => {
    if (disabled) return
    toggleTheme()
    setSwitching(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSwitching(false), 560)
  }

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={dark ? '切换到浅色模式' : '切换到深色模式'}
      aria-pressed={dark}
      title={tooltip ? undefined : dark ? '浅色模式' : '深色模式'}
      className={variant === 'login' ? 'theme-toggle' : cn(
        'theme-toggle icon-toggle relative inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground max-rail:h-11 max-rail:w-11',
        'transition-colors duration-300 hover:bg-wash hover:text-rose',
        switching && 'is-switching',
      )}
    >
      {variant === 'login' ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className="theme-moon" d="M20 14.1A8.2 8.2 0 0 1 9.9 4a8.2 8.2 0 1 0 10.1 10.1Z" />
          <g className="login-theme-sun"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="theme-sun" aria-hidden="true">
          <defs>
            <clipPath id={clipId}>
              <path className="sun-clip-path" d="M0 0h25a1 1 0 0010 10v14H0Z" />
            </clipPath>
          </defs>
          <g stroke="currentColor" strokeLinecap="round">
            <circle
              className="sun-disc"
              cx="12"
              cy="12"
              r="5"
              fill="currentColor"
              clipPath={`url(#${clipId})`}
            />
            <path className="sun-ray" d={SUN_RAYS.join(' ')} fill="none" strokeWidth={2} />
          </g>
        </svg>
      )}
    </button>
  )
  return tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{dark ? '切换到浅色模式' : '切换到深色模式'}</TooltipContent>
    </Tooltip>
  ) : button
}
