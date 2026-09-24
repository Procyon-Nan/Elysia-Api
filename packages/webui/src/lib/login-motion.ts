import { useEffect, useState } from 'react'

/** 登录页只遵循系统动态偏好和页面可见性，不另建用户偏好入口。 */
export function useLoginMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [hidden, setHidden] = useState(() => document.hidden)

  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReduced(motion.matches)
    const updateVisibility = () => setHidden(document.hidden)
    motion.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      motion.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  return { allowed: !reduced && !hidden, reduced, hidden }
}
