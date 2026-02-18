document.addEventListener('DOMContentLoaded', () => {
  const keys = document.querySelectorAll('.key');
  const currentKeyDisplay = document.getElementById('current-key');
  const keyCodeDisplay = document.getElementById('key-code');
  const resetBtn = document.getElementById('reset-btn');

  // 维护按键状态
  const activeKeys = new Set();

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
    });
    
    key.addEventListener('mouseleave', () => {
      key.classList.remove('active');
      key.classList.add('pressed');
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