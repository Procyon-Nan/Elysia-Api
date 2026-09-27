import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_ANCHOR_CLASS, roleMaskStyle } from '@/lib/role-presentation'

interface ElysiaStageProps {
  className?: string
  statusState?: 'ok' | 'err' | 'off' | 'active'
  showAura?: boolean
}

/**
 * 爱莉希雅视觉中枢舞台 (Elysia Visual Stage)
 * 将高精度立绘作为界面的核心视觉主角与氛围发生源，配合灵动微光、状态光环与水晶粒子。
 *
 * 登录交接由全局 Portal 负责；舞台本身只维护首页常驻的角色水印和氛围。
 */
export function ElysiaStage({ className, statusState = 'ok', showAura = true }: ElysiaStageProps) {
  const maskStyle = roleMaskStyle()

  return (
    <div
      aria-hidden
      className={cn(
        ROLE_ANCHOR_CLASS,
        'z-0 select-none overflow-visible',
        'transition-all duration-700 ease-out',
        className,
      )}
    >
      {/* 氛围呼吸光晕 */}
      {showAura && (
        <div className="role-stage-aura absolute -top-12 right-12 h-72 w-72 rounded-full bg-gradient-to-br from-primary/15 to-transparent blur-3xl sm:h-96 sm:w-96" />
      )}

      {/* 晶化粒子微光装饰 */}
      <div className="absolute right-1/4 top-16 hidden animate-pulse opacity-40 duration-1000 md:block">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="absolute right-1/3 top-48 hidden animate-pulse opacity-30 delay-300 md:block">
        <Sparkles className="h-3 w-3 text-orchid" />
      </div>

      {/* 立绘主体容器：高清晰度硅光色粉渐变 + 柔化羽化 Mask */}
      <div className="relative aspect-[760/808] w-full">
        <div
          className={cn(
            'role-fig absolute inset-0',
            'opacity-[0.09] transition-opacity duration-500 dark:opacity-[0.14]',
            statusState === 'active' && 'opacity-[0.13] dark:opacity-[0.18]',
          )}
          style={maskStyle}
        />
      </div>
    </div>
  )
}

/** 页面共用的立绘水印：作为低饱和度品牌暗纹，不抢夺前景信息。 */
export function RoleWatermark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-0 w-[240px] select-none opacity-[0.06] transition-opacity dark:opacity-[0.09] rail:w-[480px]',
        className,
      )}
    >
      <div className="role-fig aspect-[760/808] w-full" style={roleMaskStyle()} />
    </div>
  )
}
