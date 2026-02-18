document.addEventListener('DOMContentLoaded', () => {
  // 初始化一次历史显示
  //（避免首次进入页面时历史区域为空白）
  const keys = document.querySelectorAll('.key');
  const currentKeyDisplay = document.getElementById('current-key');
  const keyCodeDisplay = document.getElementById('key-code');
  const keyHistoryEl = document.getElementById('key-history');
  const resetBtn = document.getElementById('reset-btn');

  // 维护按键状态
  const activeKeys = new Set();

  // 按键历史队列（FIFO）
  const keyHistoryQueue = [];
  const KEY_HISTORY_MAX = 30;

  // 初始渲染
  // 注意：renderKeyHistory 定义在下方，因此这里用一个简单的 DOM 填充兜底
  if (keyHistoryEl) keyHistoryEl.textContent = '（空）';

  function renderKeyHistory() {
    if (!keyHistoryEl) return;

    if (keyHistoryQueue.length === 0) {
      keyHistoryEl.textContent = '（空）';
      return;
    }

    // 用队列渲染：最新一个为红色，其余为黑色
    keyHistoryEl.textContent = '';

    const lastIndex = keyHistoryQueue.length - 1;
    keyHistoryQueue.forEach((label, idx) => {
      const span = document.createElement('span');
      span.textContent = label;

      if (idx === lastIndex) {
        span.style.color = '#d9534f';
        span.style.fontWeight = 'bold';
      } else {
        span.style.color = '#333';
      }

      keyHistoryEl.appendChild(span);

      // 间隔
      if (idx !== lastIndex) {
        keyHistoryEl.appendChild(document.createTextNode('  '));
      }
    });
  }

  function enqueueKeyHistory(label) {
    keyHistoryQueue.push(label);
    if (keyHistoryQueue.length > KEY_HISTORY_MAX) {
      keyHistoryQueue.shift();
    }
    renderKeyHistory();
  }

  function highlightKey(code) {
    const keyElement = document.querySelector(`.key[data-key="${code}"]`);
    if (keyElement) {
      keyElement.classList.add('active');
      // 更新显示
      currentKeyDisplay.textContent = keyElement.textContent.trim();
      keyCodeDisplay.textContent = code;
    }
  }

  function resetKeyboard() {
    activeKeys.clear();
    keys.forEach(key => {
      key.classList.remove('active');
      key.classList.remove('pressed');
    });
    currentKeyDisplay.textContent = '无';
    keyCodeDisplay.textContent = '-';

    keyHistoryQueue.length = 0;
    renderKeyHistory();
  }

  document.addEventListener('keydown', (e) => {
    e.preventDefault(); // 阻止浏览器默认快捷键
    const code = e.code;
    
    if (!activeKeys.has(code)) {
      activeKeys.add(code);
      highlightKey(code);
    }
  });

  document.addEventListener('keyup', (e) => {
    const code = e.code;
    activeKeys.delete(code);
    // 移除 active 类让按键弹回，但添加 pressed 类保持红色
    const keyElement = document.querySelector(`.key[data-key="${code}"]`);
    if (keyElement) {
      keyElement.classList.remove('active');
      keyElement.classList.add('pressed');
      enqueueKeyHistory(keyElement.textContent.trim());
    }
  });

  // 鼠标点击支持
  // 鼠标点击支持
  keys.forEach(key => {
    key.addEventListener('mousedown', () => {
      const code = key.getAttribute('data-key');
      highlightKey(code);
    });
    
    key.addEventListener('mouseup', () => {
      key.classList.remove('active');
      key.classList.add('pressed');
      enqueueKeyHistory(key.textContent.trim());
    });
    
    // 仅在“鼠标按下并按键处于 active”时，移出才视为一次按键操作
    // 避免纯 hover/经过就把按键标记为 pressed（字体变红）
    key.addEventListener('mouseleave', () => {
      if (key.classList.contains('active')) {
        key.classList.remove('active');
        key.classList.add('pressed');
        enqueueKeyHistory(key.textContent.trim());
      }
    });
  });
  // 复位按钮事件
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetKeyboard();
      // 移除焦点，防止按下回车键再次触发按钮点击
      resetBtn.blur();
    });
  }
});