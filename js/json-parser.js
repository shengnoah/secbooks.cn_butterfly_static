// JSON 解析器功能
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  const jsonInput = document.getElementById('json-input');
  const jsonOutput = document.getElementById('json-output');
  const jsonInfo = document.getElementById('json-info');
  const formatBtn = document.getElementById('format-json');
  const validateBtn = document.getElementById('validate-json');
  const clearBtn = document.getElementById('clear-json');
  const copyBtn = document.getElementById('copy-json');
  const downloadBtn = document.getElementById('download-json');

  if (!jsonInput || !jsonOutput || !formatBtn) {
    console.error('JSON 解析器初始化失败：缺少必要元素');
    return;
  }

  // 格式化 JSON
  function formatJSON() {
    try {
      const input = jsonInput.value.trim();
      if (!input) {
        showMessage('请输入 JSON 数据', 'error');
        return;
      }

      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      
      highlightJSON(formatted);
      analyzeJSON(parsed);
      showMessage('JSON 格式化成功', 'success');
    } catch (error) {
      showMessage('JSON 格式错误: ' + error.message, 'error');
      jsonOutput.querySelector('code').textContent = '';
      if (jsonInfo) {
        jsonInfo.innerHTML = '';
        jsonInfo.classList.remove('show');
      }
    }
  }

  // 验证 JSON
  function validateJSON() {
    try {
      const input = jsonInput.value.trim();
      if (!input) {
        showMessage('请输入 JSON 数据', 'error');
        return;
      }

      JSON.parse(input);
      showMessage('✓ JSON 格式正确', 'success');
    } catch (error) {
      showMessage('✗ JSON 格式错误: ' + error.message, 'error');
    }
  }

  // 清空内容
  function clearAll() {
    jsonInput.value = '';
    jsonOutput.querySelector('code').textContent = '';
    if (jsonInfo) {
      jsonInfo.innerHTML = '';
      jsonInfo.classList.remove('show');
    }
    showMessage('已清空所有内容', 'success');
  }

  // 复制到剪贴板
  function copyToClipboard() {
    const text = jsonOutput.querySelector('code').textContent;
    if (!text) {
      showMessage('没有可复制的内容', 'error');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      showMessage('已复制到剪贴板', 'success');
    }).catch(() => {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showMessage('已复制到剪贴板', 'success');
    });
  }

  // 下载 JSON 文件
  function downloadJSON() {
    const text = jsonOutput.querySelector('code').textContent;
    if (!text) {
      showMessage('没有可下载的内容', 'error');
      return;
    }

    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('JSON 文件已下载', 'success');
  }

  // 分析 JSON 结构
  function analyzeJSON(obj) {
    if (!jsonInfo) return;

    const info = {
      type: Array.isArray(obj) ? 'Array' : typeof obj,
      size: JSON.stringify(obj).length,
      keys: 0,
      depth: 0
    };

    if (typeof obj === 'object' && obj !== null) {
      info.keys = Object.keys(obj).length;
      info.depth = getDepth(obj);
    }

    const html = `
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">类型</span>
          <span class="info-value">${info.type}</span>
        </div>
        <div class="info-item">
          <span class="info-label">大小</span>
          <span class="info-value">${formatBytes(info.size)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">键数量</span>
          <span class="info-value">${info.keys}</span>
        </div>
        <div class="info-item">
          <span class="info-label">嵌套深度</span>
          <span class="info-value">${info.depth}</span>
        </div>
      </div>
    `;

    jsonInfo.innerHTML = html;
    jsonInfo.classList.add('show');
  }

  // 计算对象深度
  function getDepth(obj) {
    if (typeof obj !== 'object' || obj === null) return 0;
    
    let maxDepth = 0;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const depth = getDepth(obj[key]);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    return maxDepth + 1;
  }

  // 格式化字节大小
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // 高亮 JSON
  function highlightJSON(json) {
    const highlighted = json
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });
    
    jsonOutput.querySelector('code').innerHTML = highlighted;
  }

  // 显示消息
  function showMessage(message, type) {
    // 移除已存在的消息
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
  }

  // 事件监听
  formatBtn.addEventListener('click', formatJSON);
  validateBtn.addEventListener('click', validateJSON);
  clearBtn.addEventListener('click', clearAll);
  copyBtn.addEventListener('click', copyToClipboard);
  downloadBtn.addEventListener('click', downloadJSON);

  // 快捷键支持
  jsonInput.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      formatJSON();
    }
  });

  // 示例 JSON
  const exampleJSON = {
    "name": "JSON 解析器",
    "version": "1.0.0",
    "features": ["格式化", "验证", "语法高亮", "结构分析"],
    "config": {
      "theme": "dark",
      "autoFormat": false,
      "indentSize": 2
    },
    "stats": {
      "users": 1000,
      "active": true
    }
  };

  // 加载示例
  if (!jsonInput.value.trim()) {
    jsonInput.value = JSON.stringify(exampleJSON, null, 2);
  }
});
