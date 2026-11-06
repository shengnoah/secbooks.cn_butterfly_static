/** 首页 Lua 代码逐字输入、停留、退格循环；无需第三方动画库。 */
;(function () {
  'use strict'

  // PJAX 重复执行脚本时，只重新初始化，不重复注册全局事件。
  if (window.luaHomeTypewriter) {
    window.luaHomeTypewriter.init()
    return
  }

  var dispose = function () {}

  function init () {
    dispose()
    var code = document.getElementById('lua-hero-code')
    if (!code) return

    var editor = code.closest('.lua-hero-editor')
    var state = editor.querySelector('.lua-hero-state')
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    var segments = Array.prototype.map.call(code.children, function (node) {
      return { className: node.className, chars: Array.from(node.textContent) }
    })
    var original = code.cloneNode(true)
    var cursor = document.createElement('span')
    cursor.className = 'lua-hero-cursor'
    cursor.setAttribute('aria-hidden', 'true')
    var spans = []
    var segmentIndex = 0
    var charIndex = 0
    var deleting = false
    var visible = true
    var timer = null
    var observer = null
    var stopped = false
    var pendingDelay = 600

    function schedule (delay) {
      pendingDelay = delay
      clearTimeout(timer)
      timer = null
      if (!stopped && visible && !document.hidden && !motion.matches) {
        timer = setTimeout(step, delay)
      }
    }

    function step () {
      if (!code.isConnected) { dispose(); return }
      if (deleting) {
        state.textContent = '退格中 · hello.lua'
        var tail = spans[spans.length - 1]
        if (tail) {
          tail.chars.pop()
          tail.node.textContent = tail.chars.join('')
          if (!tail.chars.length) { tail.node.remove(); spans.pop() }
          schedule(18)
        } else {
          deleting = false
          segmentIndex = 0
          charIndex = 0
          state.textContent = '准备输入 · hello.lua'
          schedule(800)
        }
        return
      }

      state.textContent = '输入中 · hello.lua'
      var segment = segments[segmentIndex]
      if (charIndex === 0) {
        var node = document.createElement('span')
        node.className = segment.className
        code.insertBefore(node, cursor)
        spans.push({ node: node, chars: [] })
      }
      var ch = segment.chars[charIndex++]
      var current = spans[spans.length - 1]
      current.chars.push(ch)
      current.node.textContent = current.chars.join('')
      if (charIndex === segment.chars.length) {
        charIndex = 0
        segmentIndex++
      }
      if (segmentIndex === segments.length) {
        deleting = true
        state.textContent = '展示中 · hello.lua'
        schedule(5000)
      } else {
        schedule(ch === '\n' ? 280 : ch === ' ' ? 20 : /[^\x00-\x7F]/.test(ch) ? 85 : 40 + Math.random() * 25)
      }
    }

    function reset () {
      clearTimeout(timer)
      code.textContent = ''
      spans = []
      segmentIndex = 0
      charIndex = 0
      deleting = false
      if (motion.matches) {
        Array.prototype.forEach.call(original.children, function (node) {
          code.appendChild(node.cloneNode(true))
        })
        state.textContent = '代码演示 · hello.lua'
      } else {
        code.appendChild(cursor)
        schedule(600)
      }
    }

    function onVisibility () { schedule(pendingDelay) }
    document.addEventListener('visibilitychange', onVisibility)
    if (motion.addEventListener) motion.addEventListener('change', reset)
    else motion.addListener(reset)
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting
        schedule(pendingDelay)
      })
      observer.observe(editor)
    }

    dispose = function () {
      stopped = true
      clearTimeout(timer)
      if (observer) observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      if (motion.removeEventListener) motion.removeEventListener('change', reset)
      else motion.removeListener(reset)
      code.textContent = ''
      Array.prototype.forEach.call(original.children, function (node) {
        code.appendChild(node.cloneNode(true))
      })
    }
    reset()
  }

  window.luaHomeTypewriter = { init: init }
  document.addEventListener('pjax:send', function () { dispose() })
  document.addEventListener('pjax:complete', init)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
