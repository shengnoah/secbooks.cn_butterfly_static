/* global Swiper */

/**
 * 将 Lua 教程目录（首页现有的 Lua 文章列表）填充到 butterfly swiper 的 `.blog-slider__wrp.swiper-wrapper` 中。
 *
 * 背景：hexo-butterfly-swiper 注入的 HTML 里 wrapper 为空，导致组件框无内容。
 */
;(function () {
  function isHomePage () {
    const p = location.pathname
    return p === '/' || p === '/index.html'
  }

  function escapeHtml (s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function collectLuaPostsFromDom () {
    const items = Array.from(document.querySelectorAll('#recent-posts .recent-post-item'))
      .filter(el => !el.querySelector('#swiper_container'))
      .map(el => {
        const a = el.querySelector('a.article-title')
        if (!a) return null

        const href = a.getAttribute('href') || ''
        const title = (a.textContent || '').trim()
        const time = (el.querySelector('time')?.textContent || '').trim()
        const cover =
          el.querySelector('.post_cover img.post-bg')?.getAttribute('src') ||
          el.querySelector('.post_cover img')?.getAttribute('src') ||
          ''

        return { href, title, time, cover }
      })
      .filter(Boolean)
      .filter(p => (p.href || '').includes('/lua/'))

    // 去重（防止某些情况下重复渲染）
    const seen = new Set()
    const uniq = []
    for (const p of items) {
      if (seen.has(p.href)) continue
      seen.add(p.href)
      uniq.push(p)
    }
    return uniq
  }

  function fillWrapperIfEmpty () {
    const wrapper = document.querySelector('#swiper_container .blog-slider__wrp.swiper-wrapper')
    if (!wrapper) {
      console.log('[Lua Swiper] wrapper 未找到')
      return false
    }

    // 已有内容则不重复填充
    if (wrapper.children && wrapper.children.length > 0) {
      console.log('[Lua Swiper] wrapper 已有内容，跳过填充')
      return true
    }

    const posts = collectLuaPostsFromDom()
    if (!posts.length) {
      console.log('[Lua Swiper] 未找到 Lua 文章')
      return false
    }

    console.log(`[Lua Swiper] 找到 ${posts.length} 篇 Lua 文章，开始填充`)

    const slidesHtml = posts
      .map((p, i) => {
        const idx = i + 1
        const title = escapeHtml(p.title)
        const href = escapeHtml(p.href)
        const time = escapeHtml(p.time || '')
        const cover = escapeHtml(p.cover || '')

        // 兼容 hexo-butterfly-swiper 的样式（尽量贴近常见结构）
        return [
          '<div class="blog-slider__item swiper-slide">',
          '  <div class="blog-slider__img">',
          `    <a href="${href}" title="${title}">`,
          cover
            ? `      <img src="${cover}" alt="${title}">`
            : '      <div class="blog-slider__img-placeholder"></div>',
          '    </a>',
          '  </div>',
          '  <div class="blog-slider__content">',
          `    <span class="blog-slider__code">Lua 教程 · 第 ${idx} 篇${time ? ' · ' + time : ''}</span>`,
          `    <div class="blog-slider__title">${title}</div>`,
          `    <a class="blog-slider__button" href="${href}">阅读</a>`,
          '  </div>',
          '</div>'
        ].join('\n')
      })
      .join('\n')

    wrapper.innerHTML = slidesHtml
    console.log('[Lua Swiper] 内容填充完成')
    return true
  }

  function ensureSwiperWorks () {
    const container = document.getElementById('swiper_container')
    if (!container) {
      console.log('[Lua Swiper] container 未找到')
      return
    }

    // 一些初始化脚本会依赖 `.swiper-container`
    container.classList.add('swiper-container')

    // 如果已存在 swiper 实例，先销毁避免重复
    if (container.swiper && typeof container.swiper.destroy === 'function') {
      try {
        container.swiper.destroy(true, true)
        console.log('[Lua Swiper] 销毁旧的 Swiper 实例')
      } catch (e) {
        console.error('[Lua Swiper] 销毁 Swiper 实例失败:', e)
      }
    }

    if (typeof Swiper !== 'function') {
      console.log('[Lua Swiper] Swiper 库未加载，等待加载')
      return
    }

    // 使用与 hexo-butterfly-swiper 完全相同的配置
    // 注意：选择器必须是 .blog-slider，与原始 swiper_init.js 一致
    try {
      // eslint-disable-next-line no-new
      const swiperInstance = new Swiper('.blog-slider', {
        passiveListeners: true,
        spaceBetween: 30,
        effect: 'fade',  // 重要：必须使用 fade 效果，与 swiperstyle.css 配合
        loop: true,
        autoplay: {
          delay: 3000,
          disableOnInteraction: true
        },
        mousewheel: true,
        pagination: {
          el: '.blog-slider__pagination',
          clickable: true
        }
      })
      
      // 添加鼠标悬停暂停功能（与原始脚本一致）
      if (container) {
        container.onmouseenter = function() {
          swiperInstance.autoplay.stop()
        }
        container.onmouseleave = function() {
          swiperInstance.autoplay.start()
        }
      }
      
      console.log('[Lua Swiper] Swiper 初始化成功 (fade 效果)')
    } catch (e) {
      console.error('[Lua Swiper] Swiper 初始化失败:', e)
    }
  }

  function run () {
    if (!isHomePage()) {
      console.log('[Lua Swiper] 非首页，跳过')
      return
    }

    console.log('[Lua Swiper] 开始执行')
    const ok = fillWrapperIfEmpty()
    if (ok) {
      // 延迟一下，确保 Swiper 库已加载
      setTimeout(ensureSwiperWorks, 100)
    }
  }

  // 使用 DOMContentLoaded 而不是 load，更早执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run)
  } else {
    // DOM 已经准备好，立即执行
    run()
  }

  // 若未来打开 pjax，也能正常刷新
  document.addEventListener('pjax:complete', run)
  document.addEventListener('pjax:end', run)
})()
