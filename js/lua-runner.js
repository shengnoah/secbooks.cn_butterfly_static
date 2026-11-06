/* ============================================================
   Lua 在线运行器 · 交互逻辑
   - 轻量 Lua 语法高亮编辑器（无外部依赖）
   - Web Worker 中执行 Lua，支持停止 / 超时
   - OpenResty ngx API 模拟结果展示
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'lua-runner:code:v1';
  var EXAMPLE_KEY = 'lua-runner:example:v1';
  var WORKER_URL = '/js/lua-runner-worker.js';

  var KEYWORDS = [
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'goto',
    'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while'
  ];
  var BUILTINS = [
    'assert', 'collectgarbage', 'dofile', 'error', 'getmetatable', 'ipairs', 'load', 'loadfile',
    'next', 'pairs', 'pcall', 'print', 'rawequal', 'rawget', 'rawlen', 'rawset', 'require',
    'select', 'setmetatable', 'tonumber', 'tostring', 'type', 'xpcall',
    'coroutine', 'debug', 'io', 'math', 'os', 'package', 'string', 'table', 'utf8',
    'ngx', 'cjson', 'inspect', 'dump'
  ];

  var EXAMPLES = {};
  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var HIGHLIGHT_RE = new RegExp(
    [
      '(--\\[\\[[\\s\\S]*?\\]\\]|--[^\\n]*)',
      '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|\\[\\[[\\s\\S]*?\\]\\])',
      '(\\b0[xX][0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d*)?(?:[eE][+-]?\\d+)?\\b)',
      '(\\b(?:' + KEYWORDS.join('|') + ')\\b)',
      '(\\b(?:' + BUILTINS.join('|') + ')\\b)',
      '([+\\-*/%^#=~<>&|.,;:(){}\\[\\]]+)'
    ].join('|'),
    'g'
  );

  function highlight(code) {
    var html = '';
    var last = 0;
    var match;
    HIGHLIGHT_RE.lastIndex = 0;
    while ((match = HIGHLIGHT_RE.exec(code)) !== null) {
      if (match.index > last) {
        html += escapeHtml(code.slice(last, match.index));
      }
      var cls = 'tok-other';
      if (match[1]) cls = 'tok-comment';
      else if (match[2]) cls = 'tok-string';
      else if (match[3]) cls = 'tok-number';
      else if (match[4]) cls = 'tok-keyword';
      else if (match[5]) cls = 'tok-builtin';
      else if (match[6]) cls = 'tok-operator';
      html += '<span class="' + cls + '">' + escapeHtml(match[0]) + '</span>';
      last = match.index + match[0].length;
    }
    if (last < code.length) {
      html += escapeHtml(code.slice(last));
    }
    // 末尾补一个换行，保证最后一行高度正确
    return html + '\n';
  }

  function initExample() {
    // 示例代码集中在 lua-runner-examples.js 中，便于单独维护
    if (window.LUA_RUNNER_EXAMPLES) {
      EXAMPLES = window.LUA_RUNNER_EXAMPLES;
    }
  }

  function loadStoredCode() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storeCode(code) {
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {
      /* 忽略隐私模式下的存储异常 */
    }
  }

  function loadStoredExample() {
    try {
      return window.localStorage.getItem(EXAMPLE_KEY) || 'basic';
    } catch (e) {
      return 'basic';
    }
  }

  function storeExample(name) {
    try {
      window.localStorage.setItem(EXAMPLE_KEY, name);
    } catch (e) {
      /* ignore */
    }
  }

  function toast(message, isError) {
    var node = document.createElement('div');
    node.className = 'lua-toast' + (isError ? ' is-error' : '');
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(function () {
      node.style.transition = 'opacity .2s ease, transform .2s ease';
      node.style.opacity = '0';
      node.style.transform = 'translateX(20px)';
      window.setTimeout(function () {
        node.remove();
      }, 220);
    }, 1800);
  }

  function formatNumber(value) {
    return Number(value).toLocaleString('zh-CN');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var input = $('lua-input');
    var highlightBox = $('lua-highlight');
    var gutter = $('lua-gutter');
    var output = $('lua-output');
    var runBtn = $('lua-run');
    var stopBtn = $('lua-stop');
    var exampleSelect = $('lua-example');
    var formatBtn = $('lua-format');
    var copyBtn = $('lua-copy');
    var resetBtn = $('lua-reset');
    var clearOutputBtn = $('lua-clear-output');
    var openrestyToggle = $('lua-openresty');
    var statusText = $('lua-run-status');
    var timeText = $('lua-run-time');
    var cursorText = $('lua-cursor');
    var charCount = $('lua-char-count');
    var responsePanel = $('lua-response');
    var responseStatus = $('lua-response-status');
    var responseTime = $('lua-response-time');
    var responseHeaders = $('lua-response-headers');
    var responseBodyWrap = $('lua-response-body-wrap');
    var responseBody = $('lua-response-body');
    var methodInput = $('lua-method');
    var uriInput = $('lua-uri');
    var bodyInput = $('lua-body');
    var stdinInput = $('lua-stdin');
    var timeoutInput = $('lua-timeout');

    if (!input || !runBtn) {
      return;
    }

    initExample();

    var worker = null;
    var running = false;
    var runStart = 0;
    var workerBroken = false;

    function getCode() {
      return input.value;
    }

    function lineCount(text) {
      return text.split('\n').length;
    }

    function syncEditor() {
      var code = input.value;
      highlightBox.innerHTML = highlight(code);

      var count = lineCount(code);
      var parts = [];
      for (var i = 1; i <= count; i++) {
        parts.push('<span>' + i + '</span>');
      }
      gutter.innerHTML = parts.join('');
      charCount.textContent = formatNumber(code.length) + ' 字符';

      var highlightPre = highlightBox.parentNode;
      highlightPre.scrollTop = input.scrollTop;
      highlightPre.scrollLeft = input.scrollLeft;
      gutter.scrollTop = input.scrollTop;
    }

    var renderTimer = null;
    function scheduleRender() {
      if (renderTimer) {
        window.cancelAnimationFrame(renderTimer);
      }
      renderTimer = window.requestAnimationFrame(syncEditor);
    }

    function updateCursor() {
      var pos = input.selectionStart || 0;
      var before = input.value.slice(0, pos);
      var line = before.split('\n').length;
      var column = pos - before.lastIndexOf('\n');
      cursorText.textContent = '行 ' + line + '，列 ' + column;
    }

    function setStatus(text, runningNow) {
      statusText.textContent = text;
      statusText.style.color = runningNow ? '#38bdf8' : '';
    }

    function clearOutput(message) {
      output.innerHTML = '<div class="lua-console__empty">' + escapeHtml(message || '点击“运行”执行代码，输出会显示在这里。') + '</div>';
      responsePanel.hidden = true;
      timeText.textContent = '';
    }

    function appendLine(text, kind, extra) {
      var empty = output.querySelector('.lua-console__empty');
      if (empty) {
        empty.remove();
      }
      var line = document.createElement('div');
      line.className = 'lua-console__line lua-console__line--' + (kind || 'stdout');
      var prefix = document.createElement('span');
      prefix.className = 'lua-console__prefix';
      prefix.textContent = kind === 'error' ? '✖' : kind === 'stderr' ? '!' : kind === 'return' ? '↩' : kind === 'info' ? '·' : '›';
      var body = document.createElement('span');
      body.className = 'lua-console__text';
      body.textContent = text;
      line.appendChild(prefix);
      line.appendChild(body);

      if (extra) {
        var trace = document.createElement('pre');
        trace.className = 'lua-console__trace';
        trace.textContent = extra;
        body.appendChild(trace);
      }

      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }

    function appendSystem(kind, text) {
      appendLine(text, kind || 'info');
    }

    function statusLabel(code) {
      var map = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        301: 'Moved Permanently',
        302: 'Found',
        304: 'Not Modified',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout'
      };
      return map[code] || '';
    }

    function splitError(message) {
      if (!message) {
        return { text: '未知错误', trace: '' };
      }
      var index = message.indexOf('\nstack traceback:');
      if (index === -1) {
        return { text: message, trace: '' };
      }
      return {
        text: message.slice(0, index),
        trace: message.slice(index + 1).replace(/\n\[JS\]:[^\n]*/g, '')
      };
    }

    function renderResponse(runner) {
      if (!openrestyToggle.checked || !runner || !runner.used) {
        responsePanel.hidden = true;
        return;
      }
      responsePanel.hidden = false;
      responseStatus.textContent = runner.status + ' ' + statusLabel(runner.status);
      responseStatus.classList.toggle('is-error', runner.status >= 400);
      responseTime.textContent = runner.elapsed + ' ms';

      var headers = runner.headers || [];
      var chips = [];
      for (var i = 0; i + 1 < headers.length; i += 2) {
        chips.push(
          '<span><b>' + escapeHtml(headers[i]) + '</b>: ' + escapeHtml(headers[i + 1]) + '</span>'
        );
      }
      responseHeaders.innerHTML = chips.length
        ? chips.join('')
        : '<span style="color:#475569">没有设置响应头</span>';

      if (runner.body) {
        responseBodyWrap.hidden = false;
        responseBody.textContent = runner.body;
      } else {
        responseBodyWrap.hidden = true;
        responseBody.textContent = '';
      }
    }

    function renderResult(result) {
      if (!result) {
        appendSystem('error', '没有收到运行结果');
        return;
      }

      var lines = result.out || [];
      var kinds = result.kind || [];
      for (var i = 0; i < lines.length; i++) {
        appendLine(lines[i], kinds[i] || 'stdout');
      }

      if (result.results && result.results.length) {
        appendLine('返回值：' + result.results.join(', '), 'return');
      }

      if (result.error) {
        var raw = String(result.error);
        if (raw.indexOf('__RUNNER_NGX_EXIT__') !== -1) {
          var status = raw.split('__RUNNER_NGX_EXIT__')[1] || '';
          appendSystem('info', 'ngx.exit(' + status.trim() + ') 已结束请求流程');
        } else if (raw.indexOf('__RUNNER_TIMEOUT__') !== -1) {
          appendSystem('error', raw.replace('__RUNNER_TIMEOUT__', ''));
        } else if (raw.indexOf('__RUNNER_LIMIT__') !== -1) {
          appendSystem('error', raw.replace('__RUNNER_LIMIT__', ''));
        } else if (raw.indexOf('__RUNNER_EXIT__') !== -1) {
          appendSystem('info', raw.replace('__RUNNER_EXIT__', ''));
        } else {
          var parsed = splitError(raw);
          appendLine(parsed.text, 'error', parsed.trace);
        }
      }

      renderResponse(result);

      if (!(result.out || []).length && !result.error && !(result.results || []).length) {
        appendSystem('info', '（没有输出，试试 print 或 ngx.say）');
      }

      timeText.textContent = '耗时 ' + result.elapsed + ' ms';
    }

    function finishRun() {
      running = false;
      runBtn.disabled = false;
      stopBtn.disabled = true;
      if (worker && !workerBroken) {
        worker.terminate();
        worker = null;
      }
      document.body.classList.remove('lua-runner-busy');
    }

    function fallbackRun() {
      // 浏览器不支持 Worker 时，在主线程执行
      if (!window.LuaEngine) {
        appendSystem('error', 'Lua 引擎未加载，请刷新页面重试');
        finishRun();
        return;
      }
      window.setTimeout(function () {
        var result = window.LuaEngine.run(getCode(), {
          stdin: stdinInput ? stdinInput.value : '',
          openresty: openrestyToggle ? openrestyToggle.checked : true,
          timeout: timeoutInput ? Number(timeoutInput.value) || 5000 : 5000,
          uri: uriInput ? uriInput.value : '',
          method: methodInput ? methodInput.value : 'GET',
          body: bodyInput ? bodyInput.value : ''
        });
        renderResult(result);
        finishRun();
      }, 30);
    }

    function run() {
      if (running) {
        return;
      }
      var code = getCode();
      if (!code.trim()) {
        toast('请先输入 Lua 代码', true);
        return;
      }

      running = true;
      runBtn.disabled = true;
      stopBtn.disabled = false;
      setStatus('运行中…', true);
      runStart = Date.now();

      output.innerHTML = '';
      responsePanel.hidden = true;
      appendSystem('info', '执行 main.lua …');

      var payload = {
        type: 'run',
        code: code,
        stdin: stdinInput ? stdinInput.value : '',
        openresty: openrestyToggle ? openrestyToggle.checked : true,
        timeout: timeoutInput ? Number(timeoutInput.value) || 5000 : 5000,
        uri: uriInput ? uriInput.value : '',
        method: methodInput ? methodInput.value : 'GET',
        body: bodyInput ? bodyInput.value : ''
      };

      try {
        if (!window.Worker) {
          throw new Error('浏览器不支持 Web Worker');
        }
        worker = new Worker(WORKER_URL);
        worker.onmessage = function (event) {
          var data = event.data || {};
          if (data.type === 'result') {
            renderResult(data.result);
            setStatus('完成');
          } else if (data.type === 'error') {
            appendSystem('error', data.message || 'Worker 执行失败');
            setStatus('执行失败');
          }
          finishRun();
        };
        worker.onerror = function (event) {
          // Worker 创建或脚本加载失败时，回退到主线程
          console.warn('[lua-runner] Worker 异常，回退到主线程：', event && event.message);
          workerBroken = true;
          if (worker) {
            worker.terminate();
            worker = null;
          }
          fallbackRun();
        };
        worker.postMessage(payload);
      } catch (err) {
        workerBroken = true;
        fallbackRun();
      }
    }

    function stop() {
      if (!running) {
        return;
      }
      if (worker) {
        worker.terminate();
        worker = null;
      }
      running = false;
      runBtn.disabled = false;
      stopBtn.disabled = true;
      appendSystem('error', '已手动停止执行');
      setStatus('已停止');
      timeText.textContent = '耗时 ' + (Date.now() - runStart) + ' ms';
    }

    function insertText(text) {
      var start = input.selectionStart;
      var end = input.selectionEnd;
      var value = input.value;

      if (typeof input.setRangeText === 'function') {
        input.setRangeText(text, start, end, 'end');
      } else {
        input.value = value.slice(0, start) + text + value.slice(end);
        input.selectionStart = input.selectionEnd = start + text.length;
      }
      scheduleRender();
      updateCursor();
      storeCode(input.value);
    }

    function handleTab(event) {
      event.preventDefault();
      var start = input.selectionStart;
      var end = input.selectionEnd;
      var value = input.value;

      if (start !== end) {
        // 多行缩进
        var lineStart = value.lastIndexOf('\n', start - 1) + 1;
        var block = value.slice(lineStart, end);
        var updated = block.split('\n').map(function (line) {
          return '  ' + line;
        }).join('\n');
        if (typeof input.setRangeText === 'function') {
          input.setRangeText(updated, lineStart, end, 'select');
        } else {
          input.value = value.slice(0, lineStart) + updated + value.slice(end);
          input.selectionStart = lineStart;
          input.selectionEnd = lineStart + updated.length;
        }
        scheduleRender();
        updateCursor();
        storeCode(input.value);
      } else {
        insertText('  ');
      }
    }

    function handleEnter(event) {
      var start = input.selectionStart;
      var end = input.selectionEnd;
      if (start !== end) {
        return;
      }
      var value = input.value;
      var lineStart = value.lastIndexOf('\n', start - 1) + 1;
      var lineEnd = value.indexOf('\n', start);
      if (lineEnd === -1) {
        lineEnd = value.length;
      }
      var currentLine = value.slice(lineStart, lineEnd);
      var indentMatch = currentLine.match(/^[ \t]*/);
      var indent = indentMatch ? indentMatch[0] : '';
      var trimmed = currentLine.trim();

      // 以 end / else / until 等开头时先减少一级缩进
      if (/^(end|else|elseif|until|\}|\))/.test(trimmed)) {
        indent = indent.slice(0, Math.max(0, indent.length - 2));
      }

      // 行尾是 then / do / function / repeat / else，或未闭合的花括号、圆括号时，增加一级缩进
      var isComment = trimmed.indexOf('--') === 0;
      var startsFunction = /^(local\s+)?function\b/.test(trimmed);
      var opensBlock = !isComment && (
        /(\bthen|\bdo|\bfunction|\brepeat|else|\{|\()\s*$/.test(trimmed) ||
        (startsFunction && /\)\s*$/.test(trimmed))
      );
      var extra = opensBlock ? '  ' : '';

      event.preventDefault();
      insertText('\n' + indent + extra);
    }

    // 初始化编辑器
    var stored = loadStoredCode();
    var initialExample = loadStoredExample();
    if (stored && stored.trim()) {
      input.value = stored;
      if (EXAMPLES[initialExample]) {
        exampleSelect.value = initialExample;
      }
    } else if (EXAMPLES[initialExample]) {
      input.value = EXAMPLES[initialExample];
      exampleSelect.value = initialExample;
    } else if (EXAMPLES.basic) {
      input.value = EXAMPLES.basic;
    }
    applyExampleOptions(exampleSelect.value);
    syncEditor();
    updateCursor();

    var saveTimer = null;
    input.addEventListener('input', function () {
      scheduleRender();
      updateCursor();
      if (saveTimer) {
        window.clearTimeout(saveTimer);
      }
      saveTimer = window.setTimeout(function () {
        storeCode(input.value);
      }, 300);
    });

    input.addEventListener('scroll', function () {
      syncEditor();
    });

    input.addEventListener('click', updateCursor);
    input.addEventListener('keyup', updateCursor);

    input.addEventListener('keydown', function (event) {
      // 中文输入法组合期间不要拦截按键
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      if (event.key === 'Tab') {
        handleTab(event);
        return;
      }
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        handleEnter(event);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        run();
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        storeCode(input.value);
        toast('代码已保存到本地浏览器');
      }
    });

    runBtn.addEventListener('click', run);
    stopBtn.addEventListener('click', stop);
    clearOutputBtn.addEventListener('click', function () {
      clearOutput();
      setStatus('就绪');
    });

    var defaultRequest = {
      method: methodInput ? methodInput.value : 'GET',
      uri: uriInput ? uriInput.value : '',
      body: bodyInput ? bodyInput.value : '',
    };

    function applyExampleOptions(name) {
      var presets = window.LUA_RUNNER_EXAMPLE_OPTIONS || {};
      var preset = presets[name];
      if (!preset) {
        return;
      }
      if (preset.method && methodInput) {
        methodInput.value = preset.method;
      }
      if (typeof preset.uri === 'string' && uriInput) {
        uriInput.value = preset.uri;
      }
      if (typeof preset.body === 'string' && bodyInput) {
        bodyInput.value = preset.body;
      }
    }

    exampleSelect.addEventListener('change', function () {
      var name = exampleSelect.value;
      var code = EXAMPLES[name];
      if (!code) {
        return;
      }
      input.value = code;
      storeCode(code);
      storeExample(name);
      applyExampleOptions(name);
      syncEditor();
      updateCursor();
      clearOutput('已加载示例：' + exampleSelect.options[exampleSelect.selectedIndex].textContent);
      setStatus('就绪');
    });

    formatBtn.addEventListener('click', function () {
      var lines = input.value.split('\n').map(function (line) {
        return line.replace(/[ \t]+$/, '');
      });
      // 合并连续 3 行以上的空行，避免脚本出现大段空白
      var compact = [];
      var blank = 0;
      lines.forEach(function (line) {
        if (line.trim() === '') {
          blank += 1;
          if (blank > 2) {
            return;
          }
        } else {
          blank = 0;
        }
        compact.push(line);
      });
      input.value = compact.join('\n');
      storeCode(input.value);
      syncEditor();
      updateCursor();
      toast('已清理行尾空格与多余空行');
    });

    copyBtn.addEventListener('click', function () {
      var code = getCode();
      if (!code) {
        toast('没有可复制的代码', true);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () {
          toast('代码已复制');
        }).catch(function () {
          toast('复制失败，请手动选择', true);
        });
      } else {
        input.select();
        try {
          document.execCommand('copy');
          toast('代码已复制');
        } catch (e) {
          toast('复制失败，请手动选择', true);
        }
      }
    });

    resetBtn.addEventListener('click', function () {
      var code = EXAMPLES.basic || '';
      input.value = code;
      storeCode(code);
      exampleSelect.value = 'basic';
      storeExample('basic');
      if (methodInput) {
        methodInput.value = defaultRequest.method;
      }
      if (uriInput) {
        uriInput.value = defaultRequest.uri;
      }
      if (bodyInput) {
        bodyInput.value = defaultRequest.body;
      }
      syncEditor();
      updateCursor();
      clearOutput();
      setStatus('就绪');
      toast('已恢复默认示例');
    });

    window.addEventListener('resize', scheduleRender);
  });
})();