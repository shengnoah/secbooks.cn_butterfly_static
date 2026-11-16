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

    // 将每个 span 拆分为「类名 + 字符数组」，用于逐字重建，保留语法高亮。
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
    var timer = null
    var stopped = false
    var pendingDelay = 400

    function schedule (delay) {
      pendingDelay = delay
      clearTimeout(timer)
      timer = null
      if (!stopped && !document.hidden) {
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
          schedule(16)
        } else {
          deleting = false
          segmentIndex = 0
          charIndex = 0
          state.textContent = '准备输入 · hello.lua'
          schedule(700)
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
        schedule(4000)
      } else {
        schedule(ch === '\n' ? 260 : ch === ' ' ? 18 : /[^\x00-\x7F]/.test(ch) ? 80 : 36 + Math.random() * 24)
      }
    }

    function reset () {
      clearTimeout(timer)
      code.textContent = ''
      spans = []
      segmentIndex = 0
      charIndex = 0
      deleting = false
      code.appendChild(cursor)
      schedule(pendingDelay)
    }

    function onVisibility () { schedule(pendingDelay) }
    document.addEventListener('visibilitychange', onVisibility)

    dispose = function () {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
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
