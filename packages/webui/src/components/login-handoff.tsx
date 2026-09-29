import { createPortal, flushSync } from 'react-dom'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getToken, setToken } from '@/lib/auth'
import { Z_INDEX } from '@/lib/z-index'
import { prepareBrandImage, readImageBounds, type ContentBounds } from '@/lib/brand-assets'
import {
  copyHandoffCanvas,
  createFlightKeyframes,
  HANDOFF_BLEND_DURATION,
  HANDOFF_FLIGHT_DURATION,
  type HandoffMotionSource,
  type HandoffSource,
} from '@/lib/login-handoff'
import './login-handoff.css'

type HandoffStage = 'idle' | 'flying' | 'blending'

interface LoginHandoffContextValue {
  active: boolean
  stage: HandoffStage
  prepareAndNavigate: (token: string, source: HandoffSource) => Promise<void>
}

interface HandoffState {
  generation: number
  stage: Exclude<HandoffStage, 'idle'>
  reducedMotion: boolean
  source: HandoffMotionSource
  snapshot: HTMLCanvasElement
  targetRect: DOMRectReadOnly
  targetBounds: ContentBounds
  targetImage: HTMLImageElement
}

const LoginHandoffContext = createContext<LoginHandoffContextValue | null>(null)

const FLIGHT_DURATION_VARIABLE = '--login-handoff-flight-duration'
const BLEND_DURATION_VARIABLE = '--login-handoff-blend-duration'

interface PreviousCssVariable {
  value: string
  priority: string
}

function installHandoffDurations(): () => void {
  const style = document.documentElement.style
  const previous: Record<string, PreviousCssVariable> = {
    [FLIGHT_DURATION_VARIABLE]: {
      value: style.getPropertyValue(FLIGHT_DURATION_VARIABLE),
      priority: style.getPropertyPriority(FLIGHT_DURATION_VARIABLE),
    },
    [BLEND_DURATION_VARIABLE]: {
      value: style.getPropertyValue(BLEND_DURATION_VARIABLE),
      priority: style.getPropertyPriority(BLEND_DURATION_VARIABLE),
    },
  }
  style.setProperty(FLIGHT_DURATION_VARIABLE, `${HANDOFF_FLIGHT_DURATION}ms`)
  style.setProperty(BLEND_DURATION_VARIABLE, `${HANDOFF_BLEND_DURATION}ms`)
  return () => {
    for (const [name, previousValue] of Object.entries(previous)) {
      if (previousValue.value) style.setProperty(name, previousValue.value, previousValue.priority)
      else style.removeProperty(name)
    }
  }
}

function readHandoffDuration(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const match = /^([\d.]+)(ms|s)$/.exec(raw)
  if (!match) return fallback
  const duration = Number(match[1]) * (match[2] === 's' ? 1000 : 1)
  return Number.isFinite(duration) && duration >= 0 ? duration : fallback
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}

function releaseHandoffState(state: HandoffState): void {
  releaseCanvas(state.snapshot)
  releaseCanvas(state.source.background.particles.canvas)
}

// eslint-disable-next-line react-refresh/only-export-components -- Provider 与其专用 hook 共用上下文
export function useLoginHandoff() {
  const context = useContext(LoginHandoffContext)
  if (!context) throw new Error('useLoginHandoff must be used within LoginHandoffProvider')
  return context
}

export function LoginHandoffProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null)
  const generationRef = useRef(0)
  const handoffRef = useRef<HandoffState | null>(null)
  const navigationCommittedRef = useRef(false)
  const animationsRef = useRef<Animation[]>([])
  const targetBoundsRef = useRef<ContentBounds | null>(null)
  const pageHiddenRef = useRef(false)
  const restoreDurationsRef = useRef<(() => void) | null>(null)
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [handoff, setHandoff] = useState<HandoffState | null>(null)

  const stopAnimations = useCallback(() => {
    animationsRef.current.forEach((animation) => animation.cancel())
    animationsRef.current = []
  }, [])

  const cancelHandoff = useCallback(() => {
    generationRef.current += 1
    stopAnimations()
    if (handoffRef.current) releaseHandoffState(handoffRef.current)
    handoffRef.current = null
    restoreDurationsRef.current?.()
    restoreDurationsRef.current = null
    navigationCommittedRef.current = false
    setHandoff(null)
  }, [stopAnimations])

  const finishHandoff = useCallback((generation: number) => {
    if (generation !== generationRef.current) return
    stopAnimations()
    if (handoffRef.current) releaseHandoffState(handoffRef.current)
    handoffRef.current = null
    restoreDurationsRef.current?.()
    restoreDurationsRef.current = null
    navigationCommittedRef.current = false
    // 到达后必须在同一次 React 提交中移除飞行 Canvas；桌面端同时恢复首页 Logo，
    // 避免浏览器在两次提交之间绘制出空白帧或重复帧。
    flushSync(() => setHandoff(null))
    requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true })
    })
  }, [stopAnimations])

  const prepareAndNavigate = useCallback(async (token: string, source: HandoffSource) => {
    if (handoffRef.current) return
    if (pageHiddenRef.current) throw new Error('页面当前不可见，无法开始登录交接')
    const image = await prepareBrandImage()
    if (pageHiddenRef.current) throw new Error('页面当前不可见，无法开始登录交接')
    const anchor = anchorRef.current
    if (!anchor) throw new Error('品牌图标锚点尚未准备完成')
    if (!targetBoundsRef.current) targetBoundsRef.current = readImageBounds(image)
    const snapshot = copyHandoffCanvas(source)
    const motionSource: HandoffMotionSource = {
      artworkRect: source.artworkRect,
      artworkWidth: source.artwork.width,
      artworkHeight: source.artwork.height,
      contentBounds: source.contentBounds,
      background: source.background,
    }
    const restoreDurations = installHandoffDurations()
    const generation = ++generationRef.current
    const state: HandoffState = {
      generation,
      stage: 'flying',
      reducedMotion: reducedMotionRef.current,
      source: motionSource,
      snapshot,
      targetRect: anchor.getBoundingClientRect(),
      targetBounds: targetBoundsRef.current,
      targetImage: image,
    }
    try {
      // 先让 Portal 接住画面，再提交 Token；避免登录页卸载时出现空白帧。
      restoreDurationsRef.current = restoreDurations
      handoffRef.current = state
      flushSync(() => setHandoff(state))
      setToken(token)
      navigate('/overview', { replace: true })
      navigationCommittedRef.current = true
    } catch (error) {
      releaseHandoffState(state)
      restoreDurations()
      handoffRef.current = null
      restoreDurationsRef.current = null
      throw error
    }
  }, [navigate])

  useLayoutEffect(() => {
    if (!handoff || handoff.stage !== 'flying') return
    const canvas = canvasRef.current
    const backgroundCanvas = backgroundCanvasRef.current
    if (!canvas || !backgroundCanvas) return
    const backgroundSnapshot = handoff.source.background.particles.canvas
    backgroundCanvas.width = backgroundSnapshot.width
    backgroundCanvas.height = backgroundSnapshot.height
    const backgroundContext = backgroundCanvas.getContext('2d')
    if (!backgroundContext) throw new Error('无法创建背景交接画布上下文')
    backgroundContext.drawImage(backgroundSnapshot, 0, 0)
    const flightDuration = readHandoffDuration(FLIGHT_DURATION_VARIABLE, HANDOFF_FLIGHT_DURATION)
    canvas.width = handoff.snapshot.width
    canvas.height = handoff.snapshot.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建刻印交接画布上下文')
    context.drawImage(handoff.snapshot, 0, 0)
    canvas.style.left = `${handoff.source.artworkRect.left}px`
    canvas.style.top = `${handoff.source.artworkRect.top}px`
    canvas.style.width = `${handoff.source.artworkRect.width}px`
    canvas.style.height = `${handoff.source.artworkRect.height}px`
    let cancelled = false
    let animation: Animation | null = null
    let completedAnimation: Animation | null = null
    const mobile = window.matchMedia('(max-width: 760px)').matches
    const reducedMotion = handoff.reducedMotion || reducedMotionRef.current
    const startAnimation = (source: HandoffMotionSource, targetRect: DOMRectReadOnly, duration: number) => {
      const keyframes = createFlightKeyframes(
        source,
        targetRect,
        handoff.targetBounds,
        handoff.targetImage.naturalWidth,
        handoff.targetImage.naturalHeight,
        reducedMotion,
      )
      animation = canvas.animate(
        keyframes,
        {
          duration,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'forwards',
        },
      )
      completedAnimation = null
      animationsRef.current = [animation]
      void animation.finished.then(() => {
        if (cancelled || handoff.generation !== generationRef.current) return
        // 状态切换会触发 effect cleanup；先把最终帧写入 inline style，避免
        // animation.cancel() 清除 transform 后，画面瞬间回到登录页中心。
        const finalTransform = keyframes[keyframes.length - 1]?.transform
        if (typeof finalTransform === 'string') canvas.style.transform = finalTransform
        completedAnimation = animation
        // 桌面端的首页 Logo 与飞行刻印使用同一资源，到达最终帧后直接原子切换，
        // 不再创建额外的终点图或透明度叠加窗口。移动端没有常驻 Logo，仍需淡出 Canvas。
        if (mobile) setHandoff((current) => current ? { ...current, stage: 'blending' } : current)
        else finishHandoff(handoff.generation)
      }, () => undefined)
    }
    startAnimation(handoff.source, handoff.targetRect, reducedMotion ? 0 : flightDuration)
    const resize = () => {
      if (cancelled || reducedMotion || !animation || animation.playState === 'finished') return
      const elapsed = typeof animation.currentTime === 'number' ? animation.currentTime : 0
      const remaining = Math.max(1, flightDuration - elapsed)
      const rect = canvas.getBoundingClientRect()
      animation.cancel()
      canvas.style.transform = 'none'
      canvas.style.left = `${rect.left}px`
      canvas.style.top = `${rect.top}px`
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      startAnimation({ ...handoff.source, artworkRect: rect }, anchorRef.current?.getBoundingClientRect() ?? handoff.targetRect, remaining)
      if (document.hidden) animation?.pause()
    }
    window.addEventListener('resize', resize)
    return () => {
      cancelled = true
      window.removeEventListener('resize', resize)
      if (animation !== completedAnimation) animation?.cancel()
    }
  }, [finishHandoff, handoff])

  useLayoutEffect(() => {
    if (!handoff || handoff.stage !== 'blending') return
    const canvas = canvasRef.current
    const mobile = window.matchMedia('(max-width: 760px)').matches
    if (!mobile || !canvas) return
    // 移动端没有常驻 BrandMark，只淡出飞行 Canvas 到预先计算的虚拟位置。
    const blendDuration = readHandoffDuration(BLEND_DURATION_VARIABLE, HANDOFF_BLEND_DURATION)
    const reducedMotion = handoff.reducedMotion || reducedMotionRef.current
    const timing = { duration: reducedMotion ? 0 : blendDuration, easing: 'ease-out', fill: 'forwards' as const }
    const animation = canvas.animate([{ opacity: 1 }, { opacity: 0 }], timing)
    animationsRef.current = [animation]
    let cancelled = false
    void animation.finished.then(() => {
      if (cancelled || handoff.generation !== generationRef.current) return
      finishHandoff(handoff.generation)
    }, () => undefined)
    return () => {
      cancelled = true
      animation.cancel()
    }
  }, [finishHandoff, handoff])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => {
      reducedMotionRef.current = motion.matches
      if (motion.matches) animationsRef.current.forEach((animation) => animation.finish())
    }
    motion.addEventListener('change', updateMotion)
    return () => motion.removeEventListener('change', updateMotion)
  }, [])

  useEffect(() => {
    const syncVisibility = () => {
      const paused = document.hidden && !!handoff
      document.documentElement.toggleAttribute('data-login-handoff-paused', paused)
      for (const animation of animationsRef.current) {
        if (paused && animation.playState === 'running') animation.pause()
        else if (!paused && animation.playState === 'paused') animation.play()
      }
    }
    document.addEventListener('visibilitychange', syncVisibility)
    syncVisibility()
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
      document.documentElement.removeAttribute('data-login-handoff-paused')
    }
  }, [handoff])

  useEffect(() => {
    const hide = () => {
      pageHiddenRef.current = true
      cancelHandoff()
    }
    const show = () => { pageHiddenRef.current = false }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => {
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
    }
  }, [cancelHandoff])

  useEffect(() => () => {
    generationRef.current += 1
    stopAnimations()
    if (handoffRef.current) releaseHandoffState(handoffRef.current)
    handoffRef.current = null
    restoreDurationsRef.current?.()
    restoreDurationsRef.current = null
  }, [stopAnimations])

  useEffect(() => {
    if (!handoff || !navigationCommittedRef.current) return
    if (location.pathname !== '/overview' || !getToken()) cancelHandoff()
  }, [cancelHandoff, handoff, location.pathname])

  const context = useMemo<LoginHandoffContextValue>(() => ({
    active: !!handoff,
    stage: handoff?.stage ?? 'idle',
    prepareAndNavigate,
  }), [handoff, prepareAndNavigate])

  return (
    <LoginHandoffContext.Provider value={context}>
      {children}
      <span ref={anchorRef} className="login-handoff-anchor" aria-hidden="true" />
      {handoff && createPortal(
        <div className={`login-handoff ${Z_INDEX.loginHandoff}`} data-stage={handoff.stage} aria-hidden="true">
          <div
            className="login-handoff-backdrop"
            style={{ background: handoff.source.background.root }}
          >
            <div
              className="login-handoff-background-garden"
              style={{
                background: handoff.source.background.garden.background,
                opacity: handoff.source.background.garden.opacity,
              }}
            >
              {handoff.source.background.mistBanks.map((mist, index) => (
                <div
                  key={index}
                  className="login-handoff-background-mist"
                  style={{
                    background: mist.background,
                    opacity: mist.opacity,
                    transform: mist.transform,
                  }}
                />
              ))}
              <div
                className="login-handoff-background-clearance"
                style={{
                  background: handoff.source.background.clearance.background,
                  opacity: handoff.source.background.clearance.opacity,
                  transform: handoff.source.background.clearance.transform,
                }}
              />
            </div>
            <canvas
              ref={backgroundCanvasRef}
              className="login-handoff-background-particles"
              style={{
                width: handoff.source.background.particles.cssWidth,
                height: handoff.source.background.particles.cssHeight,
                opacity: handoff.source.background.particles.opacity,
              }}
            />
          </div>
          <canvas ref={canvasRef} className="login-handoff-canvas" />
          <div className="login-handoff-shield" />
        </div>,
        document.body,
      )}
    </LoginHandoffContext.Provider>
  )
}
