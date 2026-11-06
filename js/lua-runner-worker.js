/*
 * Lua 运行器 Web Worker
 * 在独立线程中运行 Lua，避免死循环阻塞页面
 */
/* eslint-disable no-restricted-globals */
self.window = self;
self.document = undefined;

importScripts('/js/fengari-web.js', '/js/lua-openresty-prelude.js', '/js/lua-engine.js');

self.onmessage = function (event) {
  const data = event.data || {};
  if (data.type !== 'run') return;
  try {
    const result = self.LuaEngine.run(data.code || '', {
      stdin: data.stdin || '',
      openresty: data.openresty !== false,
      timeout: data.timeout || 5000,
      uri: data.uri || '',
      method: data.method || '',
      body: data.body || '',
    });
    self.postMessage({ type: 'result', result: result });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err && err.message ? err.message : String(err),
    });
  }
};