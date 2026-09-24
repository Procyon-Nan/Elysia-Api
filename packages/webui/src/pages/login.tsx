import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginSignet } from '@/components/login-signet'
import { LoginSignature } from '@/components/login-signature'
import { useTheme } from '@/lib/theme'
import { setToken } from '@/lib/auth'
import { ApiError, verifyToken } from '@/lib/api'
import { createAmbientParticles } from '@/lib/ambient-particles'
import { createSignet } from '@/lib/signet-renderer'
import { createTokenField } from '@/lib/token-field'
import { useLoginMotion } from '@/lib/login-motion'
import './login.css'

type LoginPhase =
  | 'loading'
  | 'entering'
  | 'shifting'
  | 'opening'
  | 'ready'
  | 'welcoming'
  | 'closing'
  | 'centering'
  | 'waiting-peak'
  | 'lighting'
  | 'lit'
  | 'exhausted'

const MAX_FAILURES = 5

function waitForAnimations(element: Element | null, subtree = false): Promise<void> {
  if (!element) return Promise.resolve()
  const animations = element.getAnimations({ subtree }).filter((animation) => {
    const iterations = animation.effect?.getComputedTiming().iterations
    return iterations !== Infinity
  })
  return Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => undefined)
}

function isCurrent(mounted: boolean, runId: number, currentRunId: number): boolean {
  return mounted && runId === currentRunId
}

export function LoginPage() {
  const { theme } = useTheme()
  const motion = useLoginMotion()
  const framePrefix = useId().replace(/:/g, '')
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [phase, setPhase] = useState<LoginPhase>('loading')
  const [failureCount, setFailureCount] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [awakening, setAwakening] = useState(false)
  const [entry, setEntry] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const signetElementRef = useRef<HTMLDivElement>(null)
  const signetMotionRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const signatureRef = useRef<HTMLElement>(null)
  const welcomeRef = useRef<HTMLParagraphElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const signetArtRef = useRef<HTMLCanvasElement>(null)
  const signetIdleGlowRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<HTMLCanvasElement>(null)
  const signetRef = useRef<Awaited<ReturnType<typeof createSignet>> | null>(null)
  const particlesRefController = useRef<ReturnType<typeof createAmbientParticles> | null>(null)
  const tokenFieldRef = useRef<ReturnType<typeof createTokenField> | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)
  const runIdRef = useRef(0)
  const failureCountRef = useRef(0)
  const inputShakeRef = useRef<Animation | null>(null)
  const idleAnimationsRef = useRef<Animation[]>([])
  const exitAnimationRef = useRef<Animation | null>(null)
  const hiddenAnimationsRef = useRef<Animation[]>([])

  const frameId = (name: string) => `${framePrefix}-${name}`
  const isBusy = verifying || phase === 'welcoming' || phase === 'closing' || phase === 'centering'
  const inputDisabled = phase !== 'ready'
  const staticMotion = motion.reduced

  // React 必须先提交阶段属性，getAnimations 才能读取该阶段新产生的动画。
  const commitPhase = useCallback((next: LoginPhase) => {
    flushSync(() => setPhase(next))
  }, [])

  const stopIdleMotion = useCallback(() => {
    idleAnimationsRef.current.forEach((animation) => animation.cancel())
    idleAnimationsRef.current = []
  }, [])

  const startIdleMotion = useCallback((reducedMotion: MediaQueryList) => {
    stopIdleMotion()
    if (reducedMotion.matches) return
    const motionElement = signetMotionRef.current
    const glowCanvas = signetIdleGlowRef.current
    if (!motionElement || !glowCanvas) return
    const timing: KeyframeAnimationOptions = { duration: 5500, iterations: Infinity, easing: 'linear' }
    idleAnimationsRef.current = [
      motionElement.animate([
        { transform: 'translateY(0px)', easing: 'ease-in-out' },
        { transform: 'translateY(-7px)', easing: 'ease-in-out' },
        { transform: 'translateY(0px)' },
      ], timing),
      glowCanvas.animate([
        { opacity: 0, easing: 'ease-in-out' },
        { opacity: 1, easing: 'ease-in-out' },
        { opacity: 0 },
      ], timing),
    ]
  }, [stopIdleMotion])

  const syncIdleMotion = useCallback(() => {
    for (const animation of idleAnimationsRef.current) {
      if (animation.playState === 'finished') continue
      if (document.hidden || phase === 'exhausted' || !motion.allowed) animation.pause()
      else animation.play()
    }
  }, [motion.allowed, phase])

  const riseToIdlePeak = useCallback(() => {
    if (staticMotion) {
      stopIdleMotion()
      return Promise.resolve(true)
    }
    const motionElement = signetMotionRef.current
    const glowCanvas = signetIdleGlowRef.current
    if (!motionElement || !glowCanvas) return Promise.resolve(true)
    const current = idleAnimationsRef.current[0]?.currentTime
    const progress = typeof current === 'number' ? current % 5500 : 0
    const risingTime = Math.min(progress, 5500 - progress)
    stopIdleMotion()
    const timing: KeyframeAnimationOptions = { duration: 2750, easing: 'ease-in-out', fill: 'forwards' }
    idleAnimationsRef.current = [
      motionElement.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(-7px)' }], timing),
      glowCanvas.animate([{ opacity: 0 }, { opacity: 1 }], timing),
    ]
    idleAnimationsRef.current.forEach((animation) => { animation.currentTime = risingTime })
    syncIdleMotion()
    return Promise.all(idleAnimationsRef.current.map((animation) => animation.finished.then(() => true, () => false)))
      .then((results) => results.every(Boolean))
  }, [staticMotion, stopIdleMotion, syncIdleMotion])

  useEffect(() => {
    mountedRef.current = true
    document.title = '登录 · Elysia API'
    const scene = sceneRef.current
    return () => {
      mountedRef.current = false
      runIdRef.current += 1
      requestRef.current?.abort()
      requestRef.current = null
      inputShakeRef.current?.cancel()
      idleAnimationsRef.current.forEach((animation) => animation.cancel())
      idleAnimationsRef.current = []
      scene?.getAnimations({ subtree: true }).forEach((animation) => animation.cancel())
    }
  }, [])

  useEffect(() => {
    const show = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      setValue('')
      setStatus('')
      setInvalid(false)
      setPhase('loading')
      setFailureCount(0)
      failureCountRef.current = 0
      setVerifying(false)
      setAwakening(false)
      setEntry((previous) => previous + 1)
    }
    window.addEventListener('pageshow', show)
    return () => {
      window.removeEventListener('pageshow', show)
    }
  }, [])

  useEffect(() => {
    const previous = document.body.style.backgroundColor
    document.body.style.backgroundColor = theme === 'dark' ? '#171222' : '#fcf9fd'
    return () => { document.body.style.backgroundColor = previous }
  }, [theme])

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previous = meta?.content
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = theme === 'dark' ? '#171222' : '#fcf9fd'
    return () => {
      if (created) meta?.remove()
      else if (meta) meta.content = previous ?? ''
    }
  }, [theme])

  useEffect(() => {
    const root = rootRef.current
    const scene = sceneRef.current
    const form = formRef.current
    const signetElement = signetElementRef.current
    const signature = signatureRef.current
    const input = inputRef.current
    const particlesCanvas = particlesRef.current
    const artCanvas = signetArtRef.current
    const idleGlowCanvas = signetIdleGlowRef.current
    if (!root || !scene || !form || !signetElement || !signature || !input || !particlesCanvas || !artCanvas || !idleGlowCanvas) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const tokenField = createTokenField(input, reducedMotion)
    const particles = createAmbientParticles(particlesCanvas, reducedMotion, [signetElement, form, signature], root)
    tokenFieldRef.current = tokenField
    particlesRefController.current = particles
    let cancelled = false

    async function enter() {
      const runId = ++runIdRef.current
      startIdleMotion(reducedMotion)
      commitPhase('entering')
      await waitForAnimations(signetElement)
      if (cancelled || !isCurrent(mountedRef.current, runId, runIdRef.current)) return
      await waitForAnimations(signature, true)
      if (cancelled || !isCurrent(mountedRef.current, runId, runIdRef.current)) return
      commitPhase('shifting')
      await waitForAnimations(signetElement)
      if (cancelled || !isCurrent(mountedRef.current, runId, runIdRef.current)) return
      commitPhase('opening')
      await waitForAnimations(form, true)
      if (cancelled || !isCurrent(mountedRef.current, runId, runIdRef.current)) return
      commitPhase('ready')
      particles.start()
      tokenField.start()
    }

    const initialization = new AbortController()
    void createSignet(artCanvas, idleGlowCanvas, reducedMotion, root, initialization.signal).then((controller) => {
      if (cancelled) {
        controller.destroy()
        return
      }
      signetRef.current = controller
      void enter()
    }).catch((error: unknown) => {
      if (cancelled) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      setStatus('页面资源加载失败，请刷新重试')
      setPhase('ready')
      particles.start()
      tokenField.start()
    })

    const dispose = () => {
      if (cancelled) return
      cancelled = true
      initialization.abort()
      runIdRef.current += 1
      requestRef.current?.abort()
      requestRef.current = null
      stopIdleMotion()
      inputShakeRef.current?.cancel()
      scene.getAnimations({ subtree: true }).forEach((animation) => animation.cancel())
      signetRef.current?.destroy()
      signetRef.current = null
      particles.destroy()
      tokenField.destroy()
      particlesRefController.current = null
      tokenFieldRef.current = null
    }
    window.addEventListener('pagehide', dispose)
    return () => {
      window.removeEventListener('pagehide', dispose)
      dispose()
    }
  }, [entry, startIdleMotion, stopIdleMotion, commitPhase])

  useEffect(() => {
    signetRef.current?.syncMotion()
    particlesRefController.current?.syncMotion()
  }, [motion.allowed, motion.reduced, motion.hidden])

  useEffect(() => {
    syncIdleMotion()
  }, [syncIdleMotion, motion.hidden])

  useEffect(() => {
    // CSS 动画由暂停属性管理；显式冻结过渡和 WAAPI，返回时继续原进度。
    if (motion.hidden) {
      const animations = sceneRef.current?.getAnimations({ subtree: true }) ?? []
      for (const animation of animations) {
        if (animation instanceof CSSAnimation || idleAnimationsRef.current.includes(animation)) continue
        if (animation.playState === 'running') {
          animation.pause()
          hiddenAnimationsRef.current.push(animation)
        }
      }
    } else {
      for (const animation of hiddenAnimationsRef.current) {
        if (animation.playState === 'paused') animation.play()
      }
      hiddenAnimationsRef.current = []
      if (exitAnimationRef.current?.playState === 'paused') exitAnimationRef.current.play()
    }
  }, [motion.hidden, phase])

  useEffect(() => {
    if (staticMotion) {
      inputShakeRef.current?.cancel()
      exitAnimationRef.current?.finish()
      if (awakening) idleAnimationsRef.current.forEach((animation) => animation.finish())
      else stopIdleMotion()
    } else if (!awakening && phase !== 'exhausted' && signetRef.current && !idleAnimationsRef.current.length) {
      startIdleMotion(window.matchMedia('(prefers-reduced-motion: reduce)'))
    }
  }, [staticMotion, awakening, phase, startIdleMotion, stopIdleMotion])

  useEffect(() => {
    signetRef.current?.refreshTheme()
    particlesRefController.current?.refreshTheme()
  }, [theme])

  const shakeInput = useCallback(() => {
    inputShakeRef.current?.cancel()
    if (motion.reduced || !formRef.current) return
    inputShakeRef.current = formRef.current.animate(
      [0, -8, 7, -5, 3, -1, 0].map((x) => ({ transform: `translateX(${x}px)`, easing: 'ease-in-out' })),
      { duration: 420 },
    )
  }, [motion.reduced])

  const rejectLogin = useCallback(async (runId: number) => {
    if (!isCurrent(mountedRef.current, runId, runIdRef.current)) return
    shakeInput()
    setInvalid(true)
    const nextCount = Math.min(MAX_FAILURES, failureCountRef.current + 1)
    failureCountRef.current = nextCount
    setFailureCount(nextCount)
    if (nextCount === MAX_FAILURES) inputRef.current?.blur()
    // 401 沿用参考页的裂痕和五格提示，不额外插入可见错误行。
    setStatus('')
    const controller = signetRef.current
    if (controller) await controller.breakApart(nextCount)
    if (!isCurrent(mountedRef.current, runId, runIdRef.current)) return
    if (nextCount >= MAX_FAILURES) {
      setPhase('exhausted')
      setStatus('')
      setValue('')
      tokenFieldRef.current?.reset()
      inputRef.current?.blur()
    } else {
      setPhase('ready')
      inputRef.current?.focus()
    }
  }, [shakeInput])

  const completeLogin = useCallback(async (token: string, runId: number) => {
    if (!isCurrent(mountedRef.current, runId, runIdRef.current)) return
    setValue('')
    inputRef.current?.blur()
    tokenFieldRef.current?.reset()
    setStatus('')
    const peakReady = riseToIdlePeak()
    setAwakening(true)
    commitPhase('welcoming')
    await waitForAnimations(welcomeRef.current, true)
    if (!isCurrent(mountedRef.current, runId, runIdRef.current)) return
    commitPhase('closing')
    await waitForAnimations(formRef.current, true)
    if (!isCurrent(mountedRef.current, runId, runIdRef.current)) return
    commitPhase('centering')
    await waitForAnimations(signetElementRef.current)
    if (!isCurrent(mountedRef.current, runId, runIdRef.current)) return
    commitPhase('waiting-peak')
    if (!await peakReady || !isCurrent(mountedRef.current, runId, runIdRef.current)) return
    commitPhase('lighting')
    const lit = await signetRef.current?.play()
    if (lit === false || !isCurrent(mountedRef.current, runId, runIdRef.current)) return
    commitPhase('lit')
    const scene = sceneRef.current
    if (!scene) return
    const exit = scene.animate(
      [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 1 }],
      { duration: motion.reduced ? 0 : 720, fill: 'forwards' },
    )
    exitAnimationRef.current = exit
    if (document.hidden) exit.pause()
    const completed = await exit.finished.then(() => true, () => false)
    exitAnimationRef.current = null
    if (!completed || !isCurrent(mountedRef.current, runId, runIdRef.current)) return
    setToken(token)
  }, [motion.reduced, riseToIdlePeak, commitPhase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (phase !== 'ready' || requestRef.current) return
    const token = value.trim()
    if (!token) {
      setStatus('请输入登陆密钥')
      setInvalid(true)
      inputRef.current?.focus()
      return
    }
    const runId = ++runIdRef.current
    const request = new AbortController()
    requestRef.current = request
    setStatus('')
    setInvalid(false)
    setVerifying(true)
    try {
      await verifyToken(token, request.signal)
      if (!isCurrent(mountedRef.current, runId, runIdRef.current)) return
      await completeLogin(token, runId)
    } catch (caught) {
      if (!isCurrent(mountedRef.current, runId, runIdRef.current) || request.signal.aborted) return
      if (caught instanceof ApiError && caught.status === 401) {
        await rejectLogin(runId)
      } else {
        setStatus(caught instanceof Error ? caught.message : '无法连接到后端，请检查网络与服务状态')
        setPhase('ready')
      }
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null
        if (mountedRef.current) setVerifying(false)
      }
    }
  }

  return (
    <div
      ref={rootRef}
      className={`login-page${awakening ? ' is-awakening' : ''}${phase === 'lit' ? ' is-lit' : ''}`}
      data-theme={theme}
      data-phase={phase}
      data-motion={motion.allowed ? 'playing' : 'paused'}
      data-background-paused={motion.hidden ? '' : undefined}
      aria-busy={isBusy}
    >
      <div className="morning-garden" aria-hidden="true">
        <div className="mist-bank mist-bank-rose" />
        <div className="mist-bank mist-bank-lilac" />
        <div className="mist-bank mist-bank-pearl" />
        <div className="background-clearance" />
      </div>
      <canvas ref={particlesRef} className="background-particles" aria-hidden="true" />
      <ThemeToggle variant="login" />
      <main>
        <div ref={sceneRef} className="login-scene" data-phase={phase}>
          <LoginSignet ref={signetElementRef} motionRef={signetMotionRef} artRef={signetArtRef} idleGlowRef={signetIdleGlowRef} />
          <form ref={formRef} className="terminal" aria-label="密钥登录" aria-busy={verifying} onSubmit={handleSubmit} noValidate>
            <span className="origin" aria-hidden="true" />
            <svg className="frame frame-upper" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={frameId('input-thread')} x1="5" y1="8" x2="286" y2="8" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--control)" />
                  <stop offset="1" stopColor="var(--control)" stopOpacity="0" />
                </linearGradient>
                <path id={frameId('input-facet')} d="M5 24L21 8L29 11L11 28Z" />
                <path id={frameId('input-ridge')} d="M5 42V24L21 8H286" pathLength="1" />
                <path id={frameId('input-detail')} d="M11 28L29 11H100" pathLength="1" />
              </defs>
              <use className="frame-facet" href={`#${frameId('input-facet')}`} />
              <use className="frame-ridge" stroke={`url(#${frameId('input-thread')})`} href={`#${frameId('input-ridge')}`} />
              <use className="frame-detail" href={`#${frameId('input-detail')}`} />
            </svg>
            <svg className="frame frame-lower" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
              <g transform="rotate(180 200 40)">
                <use className="frame-facet" href={`#${frameId('input-facet')}`} />
                <use className="frame-ridge" stroke={`url(#${frameId('input-thread')})`} href={`#${frameId('input-ridge')}`} />
                <use className="frame-detail" href={`#${frameId('input-detail')}`} />
              </g>
            </svg>
            <div className="input-line">
              <label className="sr-only" htmlFor="token">登陆密钥</label>
              <div className="token-field">
                <input
                  ref={inputRef}
                  id="token"
                  name="token"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="off"
                  enterKeyHint="go"
                  aria-required="true"
                  aria-invalid={invalid}
                  disabled={inputDisabled || failureCount === MAX_FAILURES}
                  readOnly={verifying}
                  onKeyDown={(event) => { if (event.key === 'Enter' && event.repeat) event.preventDefault() }}
                  value={value}
                  onChange={(event) => { setValue(event.target.value); setStatus(''); setInvalid(false) }}
                />
                <span className="sr-only" aria-hidden="true"><span className="token-measure" /></span>
                <span className="token-caret" aria-hidden="true" />
              </div>
            </div>
            <div className="failure-meter" role="progressbar" aria-label="错误次数" aria-valuemin={0} aria-valuemax={MAX_FAILURES} aria-valuenow={failureCount} aria-valuetext={`已输错 ${failureCount} 次，最多 ${MAX_FAILURES} 次`}>
              <span className="failure-segments" aria-hidden="true">
                {Array.from({ length: MAX_FAILURES }, (_, index) => <span key={index} className={index < failureCount ? 'is-lit' : undefined} />)}
              </span>
            </div>
            <p ref={welcomeRef} className="terminal-welcome" role="status" aria-live="polite">
              <span>{phase === 'exhausted' ? '错误次数过多，请稍后刷新重试' : phase === 'welcoming' || phase === 'closing' ? '欢迎回来' : ''}</span>
            </p>
            <p className="terminal-status" role="status" aria-live="polite">{status}</p>
          </form>
          <p className="completion-status" role="status" aria-live="polite" />
        </div>
        <noscript>请启用 JavaScript 以使用登录页。</noscript>
      </main>
      <LoginSignature ref={signatureRef} />
    </div>
  )
}
