/*
 * Lua 执行引擎
 * 依赖：window/self.fengari（fengari-web）与 LUA_OPENRESTY_PRELUDE
 * 可运行于 Web Worker 或主线程
 */
(function (global) {
  'use strict';

  // 把 Lua 字节串按 UTF-8 解码；遇到非法字节时用 U+FFFD 替换，避免抛异常
  function decodeUtf8(bytes) {
    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b1 = bytes[i];
      if (b1 < 0x80) {
        out += String.fromCharCode(b1);
        i += 1;
      } else if (b1 >= 0xC2 && b1 <= 0xDF && i + 1 < bytes.length && (bytes[i + 1] & 0xC0) === 0x80) {
        out += String.fromCharCode(((b1 & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
        i += 2;
      } else if (b1 >= 0xE0 && b1 <= 0xEF && i + 2 < bytes.length &&
        (bytes[i + 1] & 0xC0) === 0x80 && (bytes[i + 2] & 0xC0) === 0x80) {
        const cp = ((b1 & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F);
        if (cp >= 0x800 && !(cp >= 0xD800 && cp <= 0xDFFF)) {
          out += String.fromCharCode(cp);
          i += 3;
        } else {
          out += '\uFFFD';
          i += 1;
        }
      } else if (b1 >= 0xF0 && b1 <= 0xF4 && i + 3 < bytes.length &&
        (bytes[i + 1] & 0xC0) === 0x80 && (bytes[i + 2] & 0xC0) === 0x80 && (bytes[i + 3] & 0xC0) === 0x80) {
        const cp = ((b1 & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) |
          ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F);
        if (cp >= 0x10000 && cp <= 0x10FFFF) {
          const adjusted = cp - 0x10000;
          out += String.fromCharCode(0xD800 + (adjusted >> 10), 0xDC00 + (adjusted & 0x3FF));
          i += 4;
        } else {
          out += '\uFFFD';
          i += 1;
        }
      } else {
        out += '\uFFFD';
        i += 1;
      }
    }
    return out;
  }

  function readString(L, idx) {
    const bytes = global.fengari.lua.lua_tolstring(L, idx, null);
    if (!bytes) return null;
    try {
      return decodeUtf8(bytes);
    } catch (e) {
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return out;
    }
  }

  function readArrayField(L, tableIdx, field) {
    const { lua, to_luastring } = global.fengari;
    lua.lua_getfield(L, tableIdx, to_luastring(field));
    if (lua.lua_type(L, -1) !== lua.LUA_TTABLE) {
      lua.lua_pop(L, 1);
      return [];
    }
    const length = lua.lua_rawlen(L, -1);
    const result = [];
    for (let i = 1; i <= length; i++) {
      lua.lua_rawgeti(L, -1, i);
      if (lua.lua_type(L, -1) === lua.LUA_TSTRING) {
        result.push(readString(L, -1));
      } else if (lua.lua_type(L, -1) === lua.LUA_TNUMBER) {
        result.push(String(lua.lua_tonumber(L, -1)));
      } else {
        result.push('');
      }
      lua.lua_pop(L, 1);
    }
    lua.lua_pop(L, 1);
    return result;
  }

  function readNumberField(L, tableIdx, field) {
    const { lua, to_luastring } = global.fengari;
    lua.lua_getfield(L, tableIdx, to_luastring(field));
    let value = null;
    if (lua.lua_type(L, -1) === lua.LUA_TNUMBER) {
      value = lua.lua_tonumber(L, -1);
    }
    lua.lua_pop(L, 1);
    return value;
  }

  function readBooleanField(L, tableIdx, field) {
    const { lua, to_luastring } = global.fengari;
    lua.lua_getfield(L, tableIdx, to_luastring(field));
    const raw = lua.lua_toboolean(L, -1);
    const value = raw === true || raw === 1;
    lua.lua_pop(L, 1);
    return value;
  }

  // 把栈上的值转换为字符串：
  // 优先使用 Lua 的 tostring（尊重 __tostring 元方法），普通表则用 inspect 美化
  function safeToString(L, idx) {
    const { lua, lauxlib, to_luastring } = global.fengari;
    const absIdx = idx < 0 ? lua.lua_gettop(L) + idx + 1 : idx;
    lauxlib.luaL_tolstring(L, absIdx, null);
    const raw = readString(L, -1);
    lua.lua_pop(L, 1);

    const isPlainTable = raw !== null && /^table: 0x[0-9a-f]+$/i.test(raw);
    if (!isPlainTable) {
      return raw === null ? 'nil' : raw;
    }

    lua.lua_getglobal(L, to_luastring('inspect'));
    if (lua.lua_type(L, -1) === lua.LUA_TFUNCTION) {
      lua.lua_pushvalue(L, absIdx);
      if (lua.lua_pcall(L, 1, 1, 0) === 0) {
        const pretty = readString(L, -1);
        lua.lua_pop(L, 1);
        return pretty === null ? raw : pretty;
      }
      lua.lua_pop(L, 1);
    } else {
      lua.lua_pop(L, 1);
    }
    return raw;
  }

  function run(code, options) {
    options = options || {};
    const started = Date.now();
    const { lua, lauxlib, lualib, to_luastring } = global.fengari;

    if (typeof global.LUA_OPENRESTY_PRELUDE !== 'string') {
      return { error: 'OpenResty 模拟层未加载（LUA_OPENRESTY_PRELUDE 缺失）', out: [], kind: [], body: '', headers: [], results: [], status: 0, used: false, elapsed: 0 };
    }

    let L = null;
    try {
      L = lauxlib.luaL_newstate();
      lualib.luaL_openlibs(L);

      lua.lua_pushstring(L, to_luastring(options.stdin || ''));
      lua.lua_setglobal(L, to_luastring('__RUNNER_STDIN'));

      lua.lua_pushstring(L, to_luastring(options.uri || ''));
      lua.lua_setglobal(L, to_luastring('__RUNNER_REQUEST_URI'));
      lua.lua_pushstring(L, to_luastring(options.method || ''));
      lua.lua_setglobal(L, to_luastring('__RUNNER_REQUEST_METHOD'));
      lua.lua_pushstring(L, to_luastring(options.body || ''));
      lua.lua_setglobal(L, to_luastring('__RUNNER_REQUEST_BODY'));

      let status = lauxlib.luaL_loadbuffer(
        L,
        to_luastring(global.LUA_OPENRESTY_PRELUDE),
        null,
        to_luastring('=openresty-mock.lua')
      );
      if (status !== 0) {
        const err = readString(L, -1);
        return { error: '模拟层加载失败：' + err, out: [], kind: [], body: '', headers: [], results: [], status: 0, used: false, elapsed: Date.now() - started };
      }
      status = lua.lua_pcall(L, 0, 0, 0);
      if (status !== 0) {
        const err = readString(L, -1);
        return { error: '模拟层初始化失败：' + err, out: [], kind: [], body: '', headers: [], results: [], status: 0, used: false, elapsed: Date.now() - started };
      }

      if (options.openresty === false) {
        lua.lua_pushnil(L);
        lua.lua_setglobal(L, to_luastring('ngx'));
      }

      const timeout = Math.max(200, Math.min(Number(options.timeout) || 5000, 15000));
      lua.lua_sethook(
        L,
        function () {
          if (Date.now() - started > timeout) {
            lua.lua_pushstring(L, to_luastring('__RUNNER_TIMEOUT__执行超时（超过 ' + timeout + ' 毫秒），已自动终止。请检查是否存在死循环。'));
            lua.lua_error(L);
          }
        },
        lua.LUA_MASKCOUNT,
        20000
      );

      const messageHandler = function (L2) {
        const message = lua.lua_tolstring(L2, 1, null);
        const text = message ? readString(L2, 1) || '' : '';
        // 控制流标记不需要 traceback
        if (/^__(RUNNER|NGX)/.test(text)) {
          return 1;
        }
        lauxlib.luaL_traceback(L2, L2, message, 1);
        return 1;
      };

      let runtimeError = null;
      const results = [];
      const base = lua.lua_gettop(L);
      status = lauxlib.luaL_loadbuffer(L, to_luastring(code), null, to_luastring('=main.lua'));
      if (status !== 0) {
        runtimeError = readString(L, -1);
        lua.lua_settop(L, base);
      } else {
        lua.lua_pushcfunction(L, messageHandler);
        lua.lua_insert(L, base + 1);
        status = lua.lua_pcall(L, 0, lua.LUA_MULTRET, base + 1);
        if (status !== 0) {
          runtimeError = readString(L, -1);
          lua.lua_settop(L, base);
        } else {
          lua.lua_remove(L, base + 1);
          const top = lua.lua_gettop(L);
          for (let i = base + 1; i <= top; i++) {
            results.push(safeToString(L, i));
          }
          lua.lua_settop(L, base);
        }
      }

      lua.lua_sethook(L, null, 0, 0);

      lua.lua_getglobal(L, to_luastring('__RUNNER'));
      const runnerIdx = lua.lua_gettop(L);
      if (lua.lua_type(L, runnerIdx) === lua.LUA_TTABLE) {
        lua.lua_getfield(L, runnerIdx, to_luastring('flush'));
        if (lua.lua_type(L, -1) === lua.LUA_TFUNCTION) {
          if (lua.lua_pcall(L, 0, 0, 0) !== 0) {
            lua.lua_pop(L, 1);
          }
        } else {
          lua.lua_pop(L, 1);
        }

        const out = readArrayField(L, runnerIdx, 'out');
        const kind = readArrayField(L, runnerIdx, 'kind');
        const bodyParts = readArrayField(L, runnerIdx, 'body_parts');
        const statusCode = readNumberField(L, runnerIdx, 'status');
        const used = readBooleanField(L, runnerIdx, 'used');

        lua.lua_getfield(L, runnerIdx, to_luastring('header_list'));
        let headers = [];
        if (lua.lua_type(L, -1) === lua.LUA_TFUNCTION) {
          if (lua.lua_pcall(L, 0, 1, 0) === 0) {
            if (lua.lua_type(L, -1) === lua.LUA_TTABLE) {
              const length = lua.lua_rawlen(L, -1);
              for (let i = 1; i <= length; i++) {
                lua.lua_rawgeti(L, -1, i);
                headers.push(readString(L, -1));
                lua.lua_pop(L, 1);
              }
            }
            lua.lua_pop(L, 1);
          } else {
            lua.lua_pop(L, 1);
          }
        } else {
          lua.lua_pop(L, 1);
        }

        return {
          out,
          kind,
          body: bodyParts.join(''),
          status: statusCode,
          used,
          headers,
          results,
          error: runtimeError,
          elapsed: Date.now() - started,
        };
      }

      return {
        out: [],
        kind: [],
        body: '',
        status: 0,
        used: false,
        headers: [],
        results,
        error: runtimeError,
        elapsed: Date.now() - started,
      };
    } catch (err) {
      return {
        out: [],
        kind: [],
        body: '',
        status: 0,
        headers: [],
        results: [],
        error: '运行时异常：' + (err && err.message ? err.message : String(err)),
        elapsed: Date.now() - started,
      };
    } finally {
      if (L !== null) {
        try {
          lua.lua_close(L);
        } catch (e) {
          /* 忽略关闭错误 */
        }
      }
    }
  }

  global.LuaEngine = { run: run };
})(typeof self !== 'undefined' ? self : this);