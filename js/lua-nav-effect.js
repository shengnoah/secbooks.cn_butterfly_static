/**
 * 顶部导航「Lua在线运行」高亮特效
 *
 * 在主题菜单（由 _config.yml 的 menu 生成）中定位 /lua-runner/ 入口，
 * 给它套上渐变胶囊、流光、HOT 徽标等视觉元素。样式见 /css/lua-nav-effect.css。
 */
;(function () {
  'use strict'

  var TARGET_PATH = '/lua-runner'

  function normalizePath (path) {
    var normalized = String(path || '')
      .replace(/index\.html$/, '')
      .replace(/\/+$/, '')
    return normalized || '/'
  }

  function createBadge () {
    var badge = document.createElement('span')
    badge.className = 'lua-nav-badge'
    badge.setAttribute('aria-hidden', 'true')
    badge.textContent = 'HOT'
    return badge
  }

  function enhanceLink (link) {
    if (link.classList.contains('lua-nav-effect')) return

    var inner = document.createElement('span')
    inner.className = 'lua-nav-effect-inner'

    while (link.firstChild) {
      inner.appendChild(link.firstChild)
    }

    link.appendChild(inner)
    link.appendChild(createBadge())
    link.classList.add('lua-nav-effect')

    var title = link.getAttribute('title')
    link.setAttribute('title', (title ? title + ' · ' : '') + '免安装，打开即用')
  }

  function run () {
    var links = document.querySelectorAll('#nav .menus_items > .menus_item > a.site-page')

    Array.prototype.forEach.call(links, function (link) {
      var path
      try {
        path = new URL(link.href, window.location.href).pathname
      } catch (e) {
        path = link.getAttribute('href') || ''
      }

      if (normalizePath(path) !== TARGET_PATH) return
      enhanceLink(link)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run)
  } else {
    run()
  }
})()