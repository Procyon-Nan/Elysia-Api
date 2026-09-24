import { forwardRef, type Ref } from 'react'

interface Props {
  artRef: Ref<HTMLCanvasElement>
  idleGlowRef: Ref<HTMLCanvasElement>
  motionRef: Ref<HTMLDivElement>
}

/** 刻印的结构宿主；所有绘制和动画由 signet-renderer 控制器负责。 */
export const LoginSignet = forwardRef<HTMLDivElement, Props>(function LoginSignet(
  { artRef, idleGlowRef, motionRef },
  ref,
) {
  return (
    <div ref={ref} className="signet" aria-hidden="true">
      <div ref={motionRef} className="signet-motion">
        <canvas ref={idleGlowRef} className="signet-idle-glow" aria-hidden="true" />
        <canvas ref={artRef} className="signet-art" aria-hidden="true" />
      </div>
    </div>
  )
})
