// 提示逐字出现的间隔；光标移动时长在 login.css 的 .token-caret 中调整。
const HINT_INTERVAL = 110;
const HINT = '请输入登陆密钥';

export function createTokenField(input: HTMLInputElement, reducedMotion: MediaQueryList) {
  const field = input.closest<HTMLElement>('.token-field')!;
  const measure = field.querySelector<HTMLElement>('.token-measure')!;
  const caret = field.querySelector<HTMLElement>('.token-caret')!;
  let hintTimer = 0;
  let caretFrame = 0;
  let destroyed = false;

  function stopHint() {
    window.clearTimeout(hintTimer);
    hintTimer = 0;
  }

  function updateCaret() {
    caretFrame = 0;
    if (destroyed) return;
    if (input.disabled || document.activeElement !== input) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    field.classList.toggle('has-selection', start !== end);
    const position = input.selectionDirection === 'backward' ? start : end;
    measure.textContent = '•'.repeat(Array.from(input.value.slice(0, position)).length);
    const x = measure.getBoundingClientRect().width - input.scrollLeft;
    // 两侧各留 2px，长密钥横向滚动后光标仍处于可见的输入范围。
    field.style.setProperty('--caret-x', `${Math.max(0, Math.min(x, input.clientWidth - 4))}px`);
    // 输入或移动插入点时重新保持高亮，停顿后再继续闪动。
    const blink = caret.getAnimations().find(animation => animation instanceof CSSAnimation && animation.animationName === 'login-caret-blink');
    if (blink) blink.currentTime = 0;
  }

  function scheduleCaret() {
    if (destroyed) return;
    if (!caretFrame) caretFrame = requestAnimationFrame(updateCaret);
  }

  function start() {
    if (destroyed) return;
    stopHint();
    if (document.activeElement === input || input.value) return;
    input.placeholder = '';
    let length = 0;
    function typeNext() {
      if (destroyed) return;
      input.placeholder = HINT.slice(0, ++length);
      hintTimer = length < HINT.length ? window.setTimeout(typeNext, HINT_INTERVAL) : 0;
    }
    if (reducedMotion.matches) input.placeholder = HINT;
    else typeNext();
  }

  function reset() {
    if (destroyed) return;
    stopHint();
    cancelAnimationFrame(caretFrame);
    caretFrame = 0;
    input.placeholder = '';
    measure.textContent = '';
    field.classList.remove('has-selection');
    field.style.setProperty('--caret-x', '0px');
  }

  const onFocus = () => {
    stopHint();
    input.placeholder = '';
    scheduleCaret();
  };
  const onBlur = () => {
    if (!input.disabled) input.placeholder = HINT;
  };
  const onMotionChange = () => {
    if (destroyed) return;
    if (reducedMotion.matches && hintTimer) {
      stopHint();
      input.placeholder = HINT;
    }
  };
  field.classList.add('has-custom-caret');
  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);
  const events = ['input', 'select', 'keyup', 'click', 'scroll'];
  for (const event of events) {
    input.addEventListener(event, scheduleCaret);
  }
  document.addEventListener('selectionchange', scheduleCaret);
  const observer = new ResizeObserver(scheduleCaret);
  observer.observe(input);
  document.fonts.ready.then(() => { if (!destroyed) scheduleCaret(); });
  reducedMotion.addEventListener('change', onMotionChange);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopHint();
    cancelAnimationFrame(caretFrame);
    input.removeEventListener('focus', onFocus);
    input.removeEventListener('blur', onBlur);
    for (const event of events) input.removeEventListener(event, scheduleCaret);
    document.removeEventListener('selectionchange', scheduleCaret);
    reducedMotion.removeEventListener('change', onMotionChange);
    observer.disconnect();
  }

  return { start, reset, destroy };
}
