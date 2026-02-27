/**
 * AI教程卡片特效
 * 点击时产生粒子爆炸效果
 */
(function() {
  'use strict';

  // ==================== 粒子爆炸效果 ====================

  // 粒子配置
  const config = {
    particleCount: 30,        // 粒子数量
    particleSize: { min: 4, max: 12 },  // 粒子大小范围
    speed: { min: 3, max: 8 },          // 速度范围
    colors: [
      '#667eea',  // 紫蓝色
      '#764ba2',  // 紫色
      '#f093fb',  // 粉色
      '#f5576c',  // 红粉色
      '#4facfe',  // 蓝色
      '#00f2fe',  // 青色
      '#43e97b',  // 绿色
      '#ffecd2',  // 金色
    ],
    gravity: 0.15,            // 重力
    friction: 0.98,           // 摩擦力
    duration: 1000,           // 动画持续时间(ms)
  };

  // 创建canvas容器
  function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'ai-explosion-canvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 99999;
    `;
    document.body.appendChild(canvas);
    return canvas;
  }

  // 获取或创建canvas
  function getCanvas() {
    let canvas = document.getElementById('ai-explosion-canvas');
    if (!canvas) {
      canvas = createCanvas();
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    return canvas;
  }

  // 粒子类
  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * (config.particleSize.max - config.particleSize.min) + config.particleSize.min;
      this.speedX = (Math.random() - 0.5) * (config.speed.max - config.speed.min) + config.speed.min;
      this.speedY = (Math.random() - 0.5) * (config.speed.max - config.speed.min) + config.speed.min;
      this.color = config.colors[Math.floor(Math.random() * config.colors.length)];
      this.alpha = 1;
      this.decay = Math.random() * 0.02 + 0.01;
      this.rotation = Math.random() * 360;
      this.rotationSpeed = (Math.random() - 0.5) * 10;
      this.shape = Math.random() > 0.5 ? 'circle' : 'star';
    }

    update() {
      this.speedY += config.gravity;
      this.speedX *= config.friction;
      this.speedY *= config.friction;
      this.x += this.speedX;
      this.y += this.speedY;
      this.alpha -= this.decay;
      this.rotation += this.rotationSpeed;
      this.size *= 0.98;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation * Math.PI / 180);
      
      if (this.shape === 'circle') {
        // 圆形粒子带发光效果
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fill();
      } else {
        // 星形粒子
        this.drawStar(ctx, 0, 0, 5, this.size, this.size / 2);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      
      ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
    }
  }

  // 爆炸效果类
  class Explosion {
    constructor(x, y) {
      this.particles = [];
      this.canvas = getCanvas();
      this.ctx = this.canvas.getContext('2d');
      this.startTime = Date.now();
      
      // 创建粒子
      for (let i = 0; i < config.particleCount; i++) {
        this.particles.push(new Particle(x, y));
      }
      
      // 添加中心闪光
      this.flashAlpha = 1;
      this.flashX = x;
      this.flashY = y;
      
      this.animate();
    }

    animate() {
      const elapsed = Date.now() - this.startTime;
      
      if (elapsed > config.duration || this.particles.every(p => p.alpha <= 0)) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // 绘制中心闪光
      if (this.flashAlpha > 0) {
        this.ctx.save();
        this.ctx.globalAlpha = this.flashAlpha;
        const gradient = this.ctx.createRadialGradient(
          this.flashX, this.flashY, 0,
          this.flashX, this.flashY, 50
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(102, 126, 234, 0.8)');
        gradient.addColorStop(1, 'rgba(118, 75, 162, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(this.flashX, this.flashY, 50, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        this.flashAlpha -= 0.1;
      }
      
      // 更新和绘制粒子
      this.particles.forEach(particle => {
        particle.update();
        if (particle.alpha > 0) {
          particle.draw(this.ctx);
        }
      });

      requestAnimationFrame(() => this.animate());
    }
  }

  // 点击涟漪效果
  function createRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'ai-click-ripple';
    ripple.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.4) 50%, transparent 70%);
      transform: translate(-50%, -50%) scale(0);
      pointer-events: none;
      z-index: 99998;
      animation: ai-ripple-expand 0.6s ease-out forwards;
    `;
    document.body.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  // 添加涟漪动画样式
  function addRippleStyles() {
    if (document.getElementById('ai-explosion-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ai-explosion-styles';
    style.textContent = `
      @keyframes ai-ripple-expand {
        0% {
          transform: translate(-50%, -50%) scale(0);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(20);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 触发爆炸效果
  function triggerExplosion(e) {
    const x = e.clientX;
    const y = e.clientY;
    
    // 创建点击涟漪圆圈
    createRipple(x, y);
    
    // 创建粒子爆炸
    new Explosion(x, y);
  }

  // 选择器：教程卡片、归档卡片、分类卡片和标签云的链接
  const cardSelectors = '.card-tutorials .card-tutorial-list-item a, .card-archives .card-archive-list-item a, .card-categories .card-category-list-item a, .card-tag-cloud a';

  // 标记是否已初始化
  let initialized = false;

  // 初始化
  function init() {
    // 避免重复初始化
    if (initialized) return;
    initialized = true;

    // 添加涟漪动画样式
    addRippleStyles();

    // 监听卡片链接点击 - 粒子爆炸效果
    document.addEventListener('click', function(e) {
      const link = e.target.closest(cardSelectors);
      if (link) {
        triggerExplosion(e);
      }
    });

    // 窗口大小改变时更新canvas
    window.addEventListener('resize', function() {
      const canvas = document.getElementById('ai-explosion-canvas');
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });
  }

  // DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 支持 pjax 页面切换后重新初始化（事件委托不需要重新绑定，但保留以防万一）
  document.addEventListener('pjax:complete', function() {
    // 由于使用事件委托，不需要重新绑定事件
    // 但确保 canvas 存在
    getCanvas();
  });
})();
