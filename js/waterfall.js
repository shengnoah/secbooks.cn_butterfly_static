/**
 * Pinterest 风格瀑布流相册初始化脚本
 * themes/butterfly/source/js/waterfall.js
 */

(function() {
  'use strict';

  // 等待 DOM 加载完成
  const initWaterfall = function() {
    const container = document.querySelector('.waterfall-container');
    if (!container) return;

    // 添加加载状态
    container.classList.add('loading');

    // 检查是否有图片
    const items = container.querySelectorAll('.waterfall-item');
    if (items.length === 0) {
      container.classList.remove('loading');
      container.innerHTML = '<div class="waterfall-empty"><i class="fas fa-images"></i><p>暂无图片</p></div>';
      return;
    }

    // 初始化 Masonry 瀑布流布局
    const initMasonryLayout = function() {
      if (typeof Masonry === 'undefined') {
        console.warn('Masonry.js not loaded');
        container.classList.remove('loading');
        return;
      }

      const msnry = new Masonry(container, {
        itemSelector: '.waterfall-item',
        columnWidth: '.waterfall-item',
        percentPosition: true,
        gutter: 15,
        transitionDuration: '0.3s'
      });

      // 使用 imagesLoaded 确保图片加载完成后重新布局
      if (typeof imagesLoaded !== 'undefined') {
        imagesLoaded(container, function() {
          msnry.layout();
          container.classList.remove('loading');
          
          // 触发懒加载更新
          if (window.lazyLoadInstance) {
            window.lazyLoadInstance.update();
          }
        });
      } else {
        // 如果没有 imagesLoaded，延迟后重新布局
        setTimeout(function() {
          msnry.layout();
          container.classList.remove('loading');
        }, 500);
      }

      return msnry;
    };

    // 初始化布局
    let msnry = initMasonryLayout();

    // 筛选功能
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns.length > 0) {
      filterBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          // 更新按钮状态
          filterBtns.forEach(function(b) {
            b.classList.remove('active');
          });
          this.classList.add('active');

          const filter = this.dataset.filter;
          const items = container.querySelectorAll('.waterfall-item');

          // 筛选项目
          items.forEach(function(item) {
            if (filter === '*' || item.classList.contains(filter.replace('.', ''))) {
              item.style.display = '';
            } else {
              item.style.display = 'none';
            }
          });

          // 重新布局
          if (msnry) {
            setTimeout(function() {
              msnry.layout();
            }, 100);
          }
        });
      });
    }

    // 初始化 Fancybox（如果已加载）
    if (typeof Fancybox !== 'undefined') {
      Fancybox.bind('[data-fancybox="gallery"]', {
        Toolbar: {
          display: {
            left: ['infobar'],
            middle: [],
            right: ['slideshow', 'thumbs', 'close']
          }
        },
        Thumbs: {
          autoStart: false
        },
        caption: function(fancybox, carousel, slide) {
          return slide.caption || '';
        }
      });
    }
  };

  // 暴露初始化函数到全局
  window.initWaterfall = initWaterfall;

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWaterfall);
  } else {
    initWaterfall();
  }

  // PJAX 支持
  if (typeof pjax !== 'undefined') {
    document.addEventListener('pjax:complete', initWaterfall);
  }
})();
