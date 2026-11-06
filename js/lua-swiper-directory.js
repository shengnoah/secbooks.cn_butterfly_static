/* global Swiper */

/**
 * 将本站技术教程菜单填充到 butterfly swiper，替换插件推荐文章。
 * 教程入口由首页模板输出，与导航菜单保持一致。
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

  function collectTutorialsFromDom () {
    const items = Array.from(document.querySelectorAll('#home-swiper-tutorials a'))
      .map(a => ({
        href: a.getAttribute('href') || '',
        title: (a.textContent || '').trim(),
        icon: a.getAttribute('data-icon') || 'fas fa-book'
      }))
      .filter(item => item.href && item.title)

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

  function fillTutorialWrapper () {
    const wrapper = document.querySelector('#swiper_container .blog-slider__wrp.swiper-wrapper')
    if (!wrapper) {
      console.log('[Lua Swiper] wrapper 未找到')
      return false
    }

    // PJAX 的多个完成事件不应重复生成或重复初始化。
    if (wrapper.dataset.tutorialsFilled === 'true') return false

    const tutorials = collectTutorialsFromDom()
    if (!tutorials.length) {
      console.log('[Lua Swiper] 未找到本站教程入口')
      return false
    }

    // 也替换插件已经生成的推荐文章，先清理旧实例及循环副本。
    const container = document.getElementById('swiper_container')
    if (container.swiper && typeof container.swiper.destroy === 'function') {
      container.swiper.destroy(true, true)
    }

    const slidesHtml = tutorials
      .map((p, i) => {
        const idx = i + 1
        const title = escapeHtml(p.title)
        const href = escapeHtml(p.href)
        const icon = escapeHtml(p.icon)

        // 兼容 hexo-butterfly-swiper 的样式（尽量贴近常见结构）
        return [
          '<div class="blog-slider__item swiper-slide">',
          '  <div class="blog-slider__img">',
          `    <a class="blog-slider__tutorial-cover" href="${href}" title="${title}">`,
          `      <i class="${icon}" aria-hidden="true"></i>`,
          `      <span>${title}</span>`,
          '    </a>',
          '  </div>',
          '  <div class="blog-slider__content">',
          `    <span class="blog-slider__code">本站教程 · ${idx} / ${tutorials.length}</span>`,
          `    <div class="blog-slider__title">${title}</div>`,
          `    <a class="blog-slider__button" href="${href}">开始学习</a>`,
          '  </div>',
          '</div>'
        ].join('\n')
      })
      .join('\n')

    wrapper.innerHTML = slidesHtml
    wrapper.dataset.tutorialsFilled = 'true'
    console.log(`[Lua Swiper] 已填充 ${tutorials.length} 个本站教程`)
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

    // 用一个"保守配置"兜底初始化
    // 注：避免和主题/插件配置强耦合，只保证能滑动与分页可点。
    try {
      // eslint-disable-next-line no-new
      new Swiper('#swiper_container', {
        loop: true,
        speed: 500,
        slidesPerView: 1,
        spaceBetween: 0,
        autoplay: {
          delay: 3000,
          disableOnInteraction: false
        },
        pagination: {
          el: '.blog-slider__pagination',
          clickable: true
        }
      })
      console.log('[Lua Swiper] Swiper 初始化成功')
    } catch (e) {
      console.error('[Lua Swiper] Swiper 初始化失败:', e)
    }
  }

  function run () {
    if (!isHomePage()) {
      console.log('[Lua Swiper] 非首页，跳过')
      return
    }

    // 教程轮播放在右侧栏最新文章上方、归档（.sticky_layout 内）之前。
    const container = document.getElementById('swiper_container')
    const recentCard = document.querySelector('.aside-content .card-recent-post')
    if (container && recentCard) {
      const oldCard = container.closest('.recent-post-item')
      let tutorialCard = container.closest('.card-tutorial-swiper')
      if (!tutorialCard) {
        tutorialCard = document.createElement('div')
        tutorialCard.className = 'card-widget card-tutorial-swiper'
        tutorialCard.innerHTML = '<div class="item-headline"><i class="fas fa-book-open" aria-hidden="true"></i><span>本站教程</span></div>'
        tutorialCard.appendChild(container)
      }
      if (recentCard.previousElementSibling !== tutorialCard) {
        recentCard.parentNode.insertBefore(tutorialCard, recentCard)
      }
      // 移走轮播后删除插件在主文章列表留下的空卡片。
      if (oldCard) oldCard.remove()
    }

    console.log('[Lua Swiper] 开始执行')
    const ok = fillTutorialWrapper()
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
