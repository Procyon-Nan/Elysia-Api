import { cn } from '@/lib/utils'
import { brandImageUrl } from '@/lib/login-handoff'

/** 侧栏品牌块；图标几何与登录交接层共用 login-handoff.css 的变量。 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('brand-mark flex items-center gap-[11px]', className)}>
      <img
        src={brandImageUrl()}
        alt="Elysia 徽标"
        width={128}
        height={125}
        loading="eager"
        decoding="async"
        className="brand-mark-logo shrink-0 drop-shadow-[0_2px_6px_var(--halo-a)]"
      />
      <div className="min-w-0">
        <b className="block font-display font-semibold text-lg leading-[1.2] tracking-[0.02em]">
          Elysia API
        </b>
        <span className="block text-2xs uppercase tracking-[0.1em] text-muted-foreground">
          Console
        </span>
      </div>
    </div>
  )
}
