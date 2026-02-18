// Book Layout JavaScript for Go Tutorial

(function() {
  'use strict';

  // 侧边栏切换功能（移动端）
  function initSidebarToggle() {
    const sidebar = document.querySelector('.book-sidebar');
    const main = document.querySelector('.book-main');
    
    if (!sidebar || !main) return;

    // 创建切换按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'book-sidebar-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 100000;
      background: #3498db;
      color: #fff;
      border: none;
      padding: 12px 16px;
      border-radius: 6px;
      cursor: pointer;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(toggleBtn);

    // 响应式显示切换按钮
    function checkWidth() {
      if (window.innerWidth <= 1024) {
        toggleBtn.style.display = 'block';
      } else {
        toggleBtn.style.display = 'none';
        sidebar.classList.remove('active');
      }
    }

    // 切换侧边栏
    toggleBtn.addEventListener('click', function() {
      sidebar.classList.toggle('active');
    });

    // 点击主内容区关闭侧边栏
    main.addEventListener('click', function() {
      if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
      }
    });

    // 监听窗口大小变化
    window.addEventListener('resize', checkWidth);
    checkWidth();
  }

  // 顶部导航切换按钮（移动端，右侧悬浮按钮，样式与 book-sidebar-toggle 一致）
  function initTopNavToggle() {
    const nav = document.getElementById('nav');
    const bookContainer = document.getElementById('book-container') || document.querySelector('.book-container');

    // 创建切换按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'book-topnav-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.setAttribute('aria-label', '打开顶部导航');
    toggleBtn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100000;
      background: #3498db;
      color: #fff;
      border: none;
      padding: 12px 16px;
      border-radius: 6px;
      cursor: pointer;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(toggleBtn);

    function openButterflySidebarMenu() {
      // 直接打开 sidebar（不依赖触发 #toggle-menu click，避免元素被 display:none 时部分浏览器不触发）
      const menuMask = document.getElementById('menu-mask');
      const sidebarMenus = document.getElementById('sidebar-menus');
      if (!menuMask || !sidebarMenus) return;

      document.body.style.overflow = 'hidden';
      menuMask.style.display = 'block';
      sidebarMenus.classList.add('open');
    }

    // 响应式显示切换按钮 + 隐藏顶部 nav
    function checkWidth() {
      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        toggleBtn.style.display = 'block';
        if (nav) nav.style.display = 'none';
        if (bookContainer) bookContainer.style.marginTop = '20px';
      } else {
        toggleBtn.style.display = 'none';
        if (nav) nav.style.display = '';
        if (bookContainer) bookContainer.style.marginTop = '';
      }
    }

    function closeButterflySidebarMenu() {
      const menuMask = document.getElementById('menu-mask');
      const sidebarMenus = document.getElementById('sidebar-menus');
      if (!menuMask || !sidebarMenus) return;
      sidebarMenus.classList.remove('open');
      menuMask.style.display = 'none';
      document.body.style.overflow = '';
    }

    function toggleButterflySidebarMenu() {
      const sidebarMenus = document.getElementById('sidebar-menus');
      if (sidebarMenus && sidebarMenus.classList.contains('open')) {
        closeButterflySidebarMenu();
      } else {
        openButterflySidebarMenu();
      }
    }

    // 点击按钮：打开/关闭 菜单
    toggleBtn.addEventListener('click', toggleButterflySidebarMenu);

    window.addEventListener('resize', checkWidth);
    checkWidth();
  }

  // 平滑滚动
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // 代码块复制功能
  function initCodeCopy() {
    document.querySelectorAll('pre code').forEach(block => {
      const pre = block.parentElement;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-wrapper';
      wrapper.style.position = 'relative';
      
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
      copyBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(255,255,255,0.1);
        color: #ecf0f1;
        border: 1px solid rgba(255,255,255,0.2);
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.3s;
      `;

      copyBtn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.2)';
      });

      copyBtn.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(255,255,255,0.1)';
      });

      copyBtn.addEventListener('click', function() {
        const code = block.textContent;
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
          }, 2000);
        }).catch(err => {
          console.error('复制失败:', err);
        });
      });

      wrapper.appendChild(copyBtn);
    });
  }

  // 目录高亮
  function initTocHighlight() {
    const headings = document.querySelectorAll('.book-body h1, .book-body h2, .book-body h3');
    const menuLinks = document.querySelectorAll('.book-menu a');

    if (headings.length === 0 || menuLinks.length === 0) return;

    function highlightToc() {
      let current = '';
      
      headings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) {
          current = heading.id || heading.textContent;
        }
      });

      menuLinks.forEach(link => {
        link.style.color = '#bdc3c7';
        link.style.fontWeight = 'normal';
        
        if (link.textContent.includes(current)) {
          link.style.color = '#3498db';
          link.style.fontWeight = '600';
        }
      });
    }

    window.addEventListener('scroll', highlightToc);
    highlightToc();
  }

  // 返回顶部按钮
  function initBackToTop() {
    const backToTop = document.createElement('button');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTop.style.cssText = `
      position: fixed;
      bottom: 40px;
      right: 40px;
      background: #3498db;
      color: #fff;
      border: none;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
    `;

    document.body.appendChild(backToTop);

    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 300) {
        backToTop.style.opacity = '1';
        backToTop.style.visibility = 'visible';
      } else {
        backToTop.style.opacity = '0';
        backToTop.style.visibility = 'hidden';
      }
    });

    backToTop.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    backToTop.addEventListener('mouseenter', function() {
      this.style.background = '#2980b9';
      this.style.transform = 'translateY(-5px)';
    });

    backToTop.addEventListener('mouseleave', function() {
      this.style.background = '#3498db';
      this.style.transform = 'translateY(0)';
    });
  }

  // 图片放大功能
  function initImageZoom() {
    document.querySelectorAll('.book-body img').forEach(img => {
      img.style.cursor = 'zoom-in';
      
      img.addEventListener('click', function() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.9);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: zoom-out;
        `;

        const zoomedImg = document.createElement('img');
        zoomedImg.src = this.src;
        zoomedImg.style.cssText = `
          max-width: 90%;
          max-height: 90%;
          object-fit: contain;
        `;

        overlay.appendChild(zoomedImg);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function() {
          document.body.removeChild(overlay);
        });
      });
    });
  }

  // 初始化所有功能
  function init() {
    initSidebarToggle();
    initTopNavToggle();
    initSmoothScroll();
    initCodeCopy();
    initTocHighlight();
    initBackToTop();
    initImageZoom();
  }

  // DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
