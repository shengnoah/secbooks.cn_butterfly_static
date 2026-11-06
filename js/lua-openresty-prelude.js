/* 自动生成，请勿直接修改；源文件：tools/lua/openresty-mock.lua */
window.LUA_OPENRESTY_PRELUDE = String.raw`-- ============================================================================
-- lua.ren 在线 Lua 运行器 · OpenResty (ngx) 模拟层
-- 纯 Lua 5.3 实现，运行于浏览器内的 Fengari 虚拟机
-- 说明：本层用于学习与演示，行为与真实 OpenResty/Nginx 存在差异
-- ============================================================================

local RUNNER = {
  out = {},
  kind = {},
  body_parts = {},
  status = 200,
  used = false,
  track = false,
  line_limit = 2000,
}
_G.__RUNNER = RUNNER

local pending = ''

local function emit(text, kind)
  if #RUNNER.out >= RUNNER.line_limit then
    error('__RUNNER_LIMIT__输出超过 ' .. RUNNER.line_limit .. ' 行，已终止执行（可能存在死循环或输出过多）', 0)
  end
  RUNNER.out[#RUNNER.out + 1] = text == nil and 'nil' or text
  RUNNER.kind[#RUNNER.kind + 1] = kind or 'stdout'
end

-- ----------------------------------------------------------------------------
-- 值格式化（表格美化输出）
-- ----------------------------------------------------------------------------
local function quote_string(s)
  local out = { '"' }
  for i = 1, #s do
    local b = string.byte(s, i)
    local c = string.sub(s, i, i)
    if c == '"' then
      out[#out + 1] = '\\"'
    elseif c == '\\' then
      out[#out + 1] = '\\\\'
    elseif c == '\n' then
      out[#out + 1] = '\\n'
    elseif c == '\r' then
      out[#out + 1] = '\\r'
    elseif c == '\t' then
      out[#out + 1] = '\\t'
    elseif b < 32 or b == 127 then
      out[#out + 1] = string.format('\\x%02x', b)
    else
      out[#out + 1] = c
    end
  end
  out[#out + 1] = '"'
  return table.concat(out)
end

local function is_identifier(s)
  return type(s) == 'string' and s:match('^[%a_][%w_]*$') ~= nil
end

local function sorted_keys(t)
  local keys = {}
  for k in pairs(t) do
    keys[#keys + 1] = k
  end
  table.sort(keys, function(a, b)
    local ta, tb = type(a), type(b)
    if ta ~= tb then
      return ta < tb
    end
    if ta == 'number' or ta == 'string' then
      return a < b
    end
    return tostring(a) < tostring(b)
  end)
  return keys
end

local inspect

inspect = function(value, depth, seen)
  depth = depth or 0
  local t = type(value)
  if t == 'string' then
    return quote_string(value)
  end
  if t ~= 'table' then
    if t == 'number' then
      if value ~= value then
        return 'nan'
      end
      if value == math.huge then
        return 'inf'
      end
      if value == -math.huge then
        return '-inf'
      end
      if math.type and math.type(value) == 'float' then
        local s = string.format('%.14g', value)
        if not s:find('[%.eEnN]') then
          s = s .. '.0'
        end
        return s
      end
    end
    return tostring(value)
  end
  seen = seen or {}
  if seen[value] then
    return '<cycle>'
  end
  if depth >= 4 then
    return '{...}'
  end
  seen[value] = true
  local n = #value
  local parts = {}
  for i = 1, n do
    parts[#parts + 1] = inspect(value[i], depth + 1, seen)
  end
  for _, k in ipairs(sorted_keys(value)) do
    local is_array_index = type(k) == 'number' and k >= 1 and k <= n and k % 1 == 0
    if not is_array_index then
      local key
      if is_identifier(k) then
        key = k
      else
        key = '[' .. inspect(k, depth + 1, seen) .. ']'
      end
      parts[#parts + 1] = key .. ' = ' .. inspect(value[k], depth + 1, seen)
    end
  end
  seen[value] = nil
  if #parts == 0 then
    return '{}'
  end
  return '{' .. table.concat(parts, ', ') .. '}'
end

local function todisplay(value)
  if type(value) == 'table' then
    -- 尊重 __tostring 元方法，与 Lua 的 print 行为保持一致
    local mt = getmetatable(value)
    if mt and rawget(mt, '__tostring') ~= nil then
      return tostring(value)
    end
    return inspect(value)
  end
  return tostring(value)
end

_G.inspect = inspect
_G.dump = function(...)
  print(...)
end

-- ----------------------------------------------------------------------------
-- print / io.write / io.read（输出与标准输入）
-- ----------------------------------------------------------------------------
local function append_text(s)
  s = tostring(s)
  while true do
    local idx = string.find(s, '\n', 1, true)
    if not idx then
      pending = pending .. s
      break
    end
    local line = pending .. string.sub(s, 1, idx - 1)
    s = string.sub(s, idx + 1)
    pending = ''
    if string.sub(line, -1) == '\r' then
      line = string.sub(line, 1, -2)
    end
    emit(line)
  end
end

function print(...)
  local n = select('#', ...)
  local parts = {}
  for i = 1, n do
    parts[i] = todisplay((select(i, ...)))
  end
  append_text(table.concat(parts, '\t') .. '\n')
end

-- Fengari 的浏览器构建默认不加载 io 库，这里补一个最小实现
if type(io) ~= 'table' then
  _G.io = {}
end

io.write = function(...)
  for i = 1, select('#', ...) do
    append_text(todisplay((select(i, ...))))
  end
  return io.stdout
end

io.stdout = {}
function io.stdout:write(...)
  for i = 1, select('#', ...) do
    append_text(todisplay((select(i, ...))))
  end
  return self
end

RUNNER.flush = function()
  if pending ~= '' then
    emit(pending)
    pending = ''
  end
end

local stdin_cache = nil
local stdin_pos = 0

local function stdin_lines()
  if stdin_cache then
    return stdin_cache
  end
  stdin_cache = {}
  local src = _G.__RUNNER_STDIN
  if type(src) == 'string' and src ~= '' then
    if string.sub(src, -1) ~= '\n' then
      src = src .. '\n'
    end
    for line in src:gmatch('([^\n]*)\n') do
      stdin_cache[#stdin_cache + 1] = (line:gsub('\r$', ''))
    end
  end
  return stdin_cache
end

io.read = function(fmt)
  local lines = stdin_lines()
  if fmt == 'a' then
    local rest = {}
    for i = stdin_pos + 1, #lines do
      rest[#rest + 1] = lines[i]
    end
    stdin_pos = #lines
    if #rest == 0 then
      return ''
    end
    return table.concat(rest, '\n') .. '\n'
  end
  stdin_pos = stdin_pos + 1
  local line = lines[stdin_pos]
  if line == nil then
    return nil
  end
  if fmt == 'n' then
    return tonumber(line)
  end
  return line
end

os.exit = function(code)
  error('__RUNNER_EXIT__程序调用 os.exit(' .. tostring(code) .. ') 结束执行', 0)
end

local real_getenv = os.getenv
os.getenv = function(name)
  local mock = {
    LUA_PATH = '/usr/local/openresty/lualib/?.lua',
    LUA_CPATH = '/usr/local/openresty/lualib/?.so',
    PATH = '/usr/local/openresty/nginx/sbin:/usr/local/bin',
  }
  if mock[name] ~= nil then
    return mock[name]
  end
  return real_getenv(name)
end

-- ----------------------------------------------------------------------------
-- 编码工具：URI / Base64 / MD5 / CRC32
-- ----------------------------------------------------------------------------
local function escape_uri(s)
  return (tostring(s):gsub('([^%w%-%._~])', function(c)
    return string.format('%%%02X', string.byte(c))
  end))
end

local function unescape_uri(s)
  s = tostring(s)
  s = s:gsub('+', ' ')
  s = s:gsub('%%(%x%x)', function(hex)
    return string.char(tonumber(hex, 16))
  end)
  return s
end

local B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
local B64_INDEX = {}
for i = 1, #B64_CHARS do
  B64_INDEX[string.sub(B64_CHARS, i, i)] = i - 1
end
B64_INDEX['='] = 0

local function encode_base64(s, no_padding)
  s = tostring(s)
  local out = {}
  local i = 1
  local n = #s
  while i <= n do
    local b1, b2, b3 = string.byte(s, i, i + 2)
    local c1 = b1 >> 2
    local c2 = ((b1 & 3) << 4) | ((b2 or 0) >> 4)
    local c3 = (((b2 or 0) & 15) << 2) | ((b3 or 0) >> 6)
    local c4 = (b3 or 0) & 63
    out[#out + 1] = string.sub(B64_CHARS, c1 + 1, c1 + 1)
    out[#out + 1] = string.sub(B64_CHARS, c2 + 1, c2 + 1)
    if b2 then
      out[#out + 1] = string.sub(B64_CHARS, c3 + 1, c3 + 1)
    elseif not no_padding then
      out[#out + 1] = '='
    end
    if b3 then
      out[#out + 1] = string.sub(B64_CHARS, c4 + 1, c4 + 1)
    elseif not no_padding then
      out[#out + 1] = '='
    end
    i = i + 3
  end
  return table.concat(out)
end

local function decode_base64(s)
  s = tostring(s):gsub('%s+', '')
  if #s % 4 ~= 0 then
    return nil, 'invalid base64 length'
  end
  local out = {}
  for i = 1, #s, 4 do
    local c1 = B64_INDEX[string.sub(s, i, i)]
    local c2 = B64_INDEX[string.sub(s, i + 1, i + 1)]
    local c3 = B64_INDEX[string.sub(s, i + 2, i + 2)]
    local c4 = B64_INDEX[string.sub(s, i + 3, i + 3)]
    if not c1 or not c2 then
      return nil, 'invalid base64 character'
    end
    out[#out + 1] = string.char((c1 << 2) | (c2 >> 4))
    if string.sub(s, i + 2, i + 2) ~= '=' then
      out[#out + 1] = string.char(((c2 & 15) << 4) | (c3 >> 2))
    end
    if string.sub(s, i + 3, i + 3) ~= '=' then
      out[#out + 1] = string.char(((c3 & 3) << 6) | c4)
    end
  end
  return table.concat(out)
end

local MD5_SHIFT = {
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
}
local MD5_K = {}
for i = 1, 64 do
  local raw = math.abs(math.sin(i)) * 4294967296
  raw = raw - math.floor(raw / 4294967296) * 4294967296
  if raw >= 2147483648 then
    raw = raw - 4294967296
  end
  MD5_K[i] = math.floor(raw) | 0
end

local function rotate_left(x, n)
  return ((x << n) | (x >> (32 - n))) & 0xFFFFFFFF
end

local function md5_bin(message)
  message = tostring(message)
  local bit_len = #message * 8
  message = message .. '\128'
  while #message % 64 ~= 56 do
    message = message .. '\0'
  end
  local len_bytes = {}
  for i = 0, 7 do
    len_bytes[#len_bytes + 1] = string.char((bit_len >> (8 * i)) & 0xFF)
  end
  message = message .. table.concat(len_bytes)

  local a0, b0, c0, d0 = 0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476
  for offset = 1, #message, 64 do
    local m = {}
    for j = 0, 15 do
      local b1, b2, b3, b4 = string.byte(message, offset + j * 4, offset + j * 4 + 3)
      m[j] = (b1 | (b2 << 8) | (b3 << 16) | (b4 << 24)) & 0xFFFFFFFF
    end
    local a, b, c, d = a0, b0, c0, d0
    for i = 1, 64 do
      local f, g
      if i <= 16 then
        f = (b & c) | ((~b) & d)
        g = i - 1
      elseif i <= 32 then
        f = (d & b) | ((~d) & c)
        g = (5 * (i - 1) + 1) % 16
      elseif i <= 48 then
        f = b ~ c ~ d
        g = (3 * (i - 1) + 5) % 16
      else
        f = c ~ (b | (~d))
        g = (7 * (i - 1)) % 16
      end
      f = (f + a + MD5_K[i] + m[g]) & 0xFFFFFFFF
      a = d
      d = c
      c = b
      b = (b + rotate_left(f, MD5_SHIFT[i])) & 0xFFFFFFFF
    end
    a0 = (a0 + a) & 0xFFFFFFFF
    b0 = (b0 + b) & 0xFFFFFFFF
    c0 = (c0 + c) & 0xFFFFFFFF
    d0 = (d0 + d) & 0xFFFFFFFF
  end

  local out = {}
  for _, word in ipairs({ a0, b0, c0, d0 }) do
    for i = 0, 3 do
      out[#out + 1] = string.char((word >> (8 * i)) & 0xFF)
    end
  end
  return table.concat(out)
end

local function md5_hex(message)
  return (md5_bin(message):gsub('.', function(c)
    return string.format('%02x', string.byte(c))
  end))
end

local crc_table = nil
local function crc32(s)
  if not crc_table then
    crc_table = {}
    for i = 0, 255 do
      local c = i
      for _ = 1, 8 do
        if (c & 1) == 1 then
          c = 0xEDB88320 ~ (c >> 1)
        else
          c = c >> 1
        end
      end
      crc_table[i] = c & 0xFFFFFFFF
    end
  end
  local crc = 0xFFFFFFFF
  for i = 1, #s do
    crc = crc_table[(crc ~ string.byte(s, i)) & 0xFF] ~ (crc >> 8)
  end
  local value = crc ~ 0xFFFFFFFF
  if value < 0 then
    value = value + 4294967296
  end
  return value
end

-- ----------------------------------------------------------------------------
-- 查询字符串
-- ----------------------------------------------------------------------------
local function parse_query(qs)
  local result = {}
  if type(qs) ~= 'string' or qs == '' then
    return result
  end
  for pair in qs:gmatch('[^&]+') do
    local key, value = pair:match('^([^=]*)=(.*)$')
    if not key then
      key, value = pair, ''
    end
    key = unescape_uri(key)
    value = unescape_uri(value)
    if result[key] == nil then
      result[key] = value
    elseif type(result[key]) == 'table' then
      result[key][#result[key] + 1] = value
    else
      result[key] = { result[key], value }
    end
  end
  return result
end

local function encode_args(t)
  local keys = {}
  for k in pairs(t) do
    keys[#keys + 1] = k
  end
  table.sort(keys, function(a, b)
    return tostring(a) < tostring(b)
  end)
  local parts = {}
  for _, k in ipairs(keys) do
    local v = t[k]
    if type(v) == 'table' then
      for _, item in ipairs(v) do
        parts[#parts + 1] = escape_uri(k) .. '=' .. escape_uri(item)
      end
    elseif v == true then
      parts[#parts + 1] = escape_uri(k)
    elseif v ~= nil and v ~= false then
      parts[#parts + 1] = escape_uri(k) .. '=' .. escape_uri(v)
    end
  end
  return table.concat(parts, '&')
end

-- ----------------------------------------------------------------------------
-- JSON（cjson 兼容子集）
-- ----------------------------------------------------------------------------
local function utf8_char(cp)
  if cp < 0x80 then
    return string.char(cp)
  elseif cp < 0x800 then
    return string.char(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F))
  elseif cp < 0x10000 then
    return string.char(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F))
  end
  return string.char(
    0xF0 | (cp >> 18),
    0x80 | ((cp >> 12) & 0x3F),
    0x80 | ((cp >> 6) & 0x3F),
    0x80 | (cp & 0x3F)
  )
end

local function json_quote(s)
  local out = { '"' }
  for i = 1, #s do
    local b = string.byte(s, i)
    if b == 34 then
      out[#out + 1] = '\\"'
    elseif b == 92 then
      out[#out + 1] = '\\\\'
    elseif b == 8 then
      out[#out + 1] = '\\b'
    elseif b == 9 then
      out[#out + 1] = '\\t'
    elseif b == 10 then
      out[#out + 1] = '\\n'
    elseif b == 12 then
      out[#out + 1] = '\\f'
    elseif b == 13 then
      out[#out + 1] = '\\r'
    elseif b < 32 then
      out[#out + 1] = string.format('\\u%04x', b)
    else
      out[#out + 1] = string.char(b)
    end
  end
  out[#out + 1] = '"'
  return table.concat(out)
end

local function json_encode(value)
  local seen = {}
  local function enc(v, depth)
    local t = type(v)
    if v == nil then
      return 'null'
    elseif t == 'boolean' then
      return v and 'true' or 'false'
    elseif t == 'number' then
      if v ~= v or v == math.huge or v == -math.huge then
        error('无法将 NaN/Infinity 编码为 JSON', 0)
      end
      if math.type and math.type(v) == 'integer' then
        return string.format('%d', v)
      end
      return string.format('%.14g', v)
    elseif t == 'string' then
      return json_quote(v)
    elseif t ~= 'table' then
      error('无法将 ' .. t .. ' 类型编码为 JSON', 0)
    end
    if seen[v] then
      error('存在循环引用的表，无法编码为 JSON', 0)
    end
    if depth > 32 then
      error('表嵌套层级过深，无法编码为 JSON', 0)
    end
    seen[v] = true
    local n = #v
    local count = 0
    local is_array = true
    for k in pairs(v) do
      count = count + 1
      if not (type(k) == 'number' and k >= 1 and k <= n and k % 1 == 0) then
        is_array = false
        break
      end
    end
    local out
    if count == 0 then
      out = '{}'
    elseif is_array then
      local parts = {}
      for i = 1, n do
        parts[i] = enc(v[i], depth + 1)
      end
      out = '[' .. table.concat(parts, ',') .. ']'
    else
      local parts = {}
      for _, k in ipairs(sorted_keys(v)) do
        parts[#parts + 1] = json_quote(tostring(k)) .. ':' .. enc(v[k], depth + 1)
      end
      out = '{' .. table.concat(parts, ',') .. '}'
    end
    seen[v] = nil
    return out
  end
  return enc(value, 0)
end

local function json_decode(text)
  if type(text) ~= 'string' then
    error('cjson.decode 需要一个字符串参数', 0)
  end
  local pos = 1
  local len = #text

  local function fail(msg)
    local line = 1
    for _ in text:sub(1, pos - 1):gmatch('\n') do
      line = line + 1
    end
    error(string.format('JSON 解析失败（第 %d 行，第 %d 字节）: %s', line, pos, msg), 0)
  end

  local function skip_ws()
    local s = text:find('[^ \t\r\n]', pos)
    if not s then
      pos = len + 1
    else
      pos = s
    end
  end

  local parse_value

  local function parse_string()
    pos = pos + 1
    local buf = {}
    while true do
      local c = text:sub(pos, pos)
      if c == '' then
        fail('字符串没有结束')
      elseif c == '"' then
        pos = pos + 1
        return table.concat(buf)
      elseif c == '\\' then
        local esc = text:sub(pos + 1, pos + 1)
        if esc == '"' or esc == '\\' or esc == '/' then
          buf[#buf + 1] = esc
          pos = pos + 2
        elseif esc == 'b' then
          buf[#buf + 1] = '\b'
          pos = pos + 2
        elseif esc == 'f' then
          buf[#buf + 1] = '\f'
          pos = pos + 2
        elseif esc == 'n' then
          buf[#buf + 1] = '\n'
          pos = pos + 2
        elseif esc == 'r' then
          buf[#buf + 1] = '\r'
          pos = pos + 2
        elseif esc == 't' then
          buf[#buf + 1] = '\t'
          pos = pos + 2
        elseif esc == 'u' then
          local hex = text:sub(pos + 2, pos + 5)
          local cp = tonumber(hex, 16)
          if not cp or #hex < 4 then
            fail('无效的 \\u 转义')
          end
          pos = pos + 6
          if cp >= 0xD800 and cp <= 0xDBFF and text:sub(pos, pos + 1) == '\\u' then
            local low = tonumber(text:sub(pos + 2, pos + 5), 16)
            if low and low >= 0xDC00 and low <= 0xDFFF then
              cp = 0x10000 + ((cp - 0xD800) << 10) + (low - 0xDC00)
              pos = pos + 6
            end
          end
          buf[#buf + 1] = utf8_char(cp)
        else
          fail('未知的转义字符 \\' .. esc)
        end
      else
        buf[#buf + 1] = c
        pos = pos + 1
      end
    end
  end

  local function parse_number()
    local start = pos
    if text:sub(pos, pos) == '-' then
      pos = pos + 1
    end
    local int_part = text:match('^%d+', pos)
    if not int_part then
      pos = start
      fail('无效的数字')
    end
    pos = pos + #int_part
    if text:sub(pos, pos) == '.' then
      pos = pos + 1
      local frac = text:match('^%d+', pos)
      if frac then
        pos = pos + #frac
      end
    end
    local e = text:sub(pos, pos)
    if e == 'e' or e == 'E' then
      local save = pos
      pos = pos + 1
      local sign = text:sub(pos, pos)
      if sign == '+' or sign == '-' then
        pos = pos + 1
      end
      local exp = text:match('^%d+', pos)
      if exp then
        pos = pos + #exp
      else
        pos = save
      end
    end
    local num = tonumber(text:sub(start, pos - 1))
    if not num then
      fail('无效的数字')
    end
    return num
  end

  parse_value = function()
    skip_ws()
    local c = text:sub(pos, pos)
    if c == '' then
      fail('意外的输入结束')
    elseif c == '"' then
      return parse_string()
    elseif c == '{' then
      pos = pos + 1
      local obj = {}
      skip_ws()
      if text:sub(pos, pos) == '}' then
        pos = pos + 1
        return obj
      end
      while true do
        skip_ws()
        if text:sub(pos, pos) ~= '"' then
          fail('对象的键必须是字符串')
        end
        local key = parse_string()
        skip_ws()
        if text:sub(pos, pos) ~= ':' then
          fail('缺少冒号')
        end
        pos = pos + 1
        obj[key] = parse_value()
        skip_ws()
        local sep = text:sub(pos, pos)
        if sep == ',' then
          pos = pos + 1
        elseif sep == '}' then
          pos = pos + 1
          return obj
        else
          fail('对象缺少逗号或右花括号')
        end
      end
    elseif c == '[' then
      pos = pos + 1
      local arr = {}
      skip_ws()
      if text:sub(pos, pos) == ']' then
        pos = pos + 1
        return arr
      end
      while true do
        arr[#arr + 1] = parse_value()
        skip_ws()
        local sep = text:sub(pos, pos)
        if sep == ',' then
          pos = pos + 1
        elseif sep == ']' then
          pos = pos + 1
          return arr
        else
          fail('数组缺少逗号或右方括号')
        end
      end
    elseif text:sub(pos, pos + 3) == 'true' then
      pos = pos + 4
      return true
    elseif text:sub(pos, pos + 4) == 'false' then
      pos = pos + 5
      return false
    elseif text:sub(pos, pos + 3) == 'null' then
      pos = pos + 4
      return nil
    else
      return parse_number()
    end
  end

  local value = parse_value()
  skip_ws()
  if pos <= len then
    fail('JSON 结束后存在多余内容')
  end
  return value
end

local cjson = {
  _VERSION = '2.1.0 (mock)',
}

function cjson.encode(value)
  return json_encode(value)
end

function cjson.decode(text)
  return json_decode(text)
end

local cjson_safe = {}
function cjson_safe.encode(value)
  local ok, result = pcall(json_encode, value)
  if ok then
    return result
  end
  return nil, result
end
function cjson_safe.decode(text)
  local ok, result = pcall(json_decode, text)
  if ok then
    return result
  end
  return nil, result
end
cjson.safe = cjson_safe
package.loaded['cjson'] = cjson
package.loaded['cjson.safe'] = cjson_safe
package.preload['cjson'] = function()
  return cjson
end
package.preload['cjson.safe'] = function()
  return cjson_safe
end

-- @@NGX@@
-- ----------------------------------------------------------------------------
-- ngx 核心
-- ----------------------------------------------------------------------------
local ngx_header, ngx_var, ngx_ctx, ngx_req, ngx_re, ngx_shared
local header_data = {}
local request_state = {
  method = 'GET',
  uri = '/lua-runner/demo',
  args = 'name=OpenResty&lang=zh',
  headers = {
    host = 'lua.ren',
    ['user-agent'] = 'Mozilla/5.0 (lua.ren Lua Playground)',
    accept = '*/*',
  },
  body = nil,
  http_version = 1.1,
}

-- 由页面传入的模拟请求（在加载模拟层之前设置）
do
  local uri = _G.__RUNNER_REQUEST_URI
  if type(uri) == 'string' and uri ~= '' then
    local path, query = uri:match('^([^?]*)%??(.*)$')
    request_state.uri = (path ~= nil and path ~= '') and path or '/'
    request_state.args = query or ''
  end
  local method = _G.__RUNNER_REQUEST_METHOD
  if type(method) == 'string' and method ~= '' then
    request_state.method = string.upper(method)
  end
  local body = _G.__RUNNER_REQUEST_BODY
  if type(body) == 'string' then
    request_state.body = body
  end
end

local function header_set(name, value)
  if RUNNER.track then
    RUNNER.used = true
  end
  name = tostring(name):gsub('_', '-')
  local lower = string.lower(name)
  if value == nil then
    header_data[lower] = nil
  else
    header_data[lower] = { name = name, value = value }
  end
end

local function header_reset(t)
  header_data = {}
  if type(t) == 'table' then
    for k, v in pairs(t) do
      header_set(k, v)
    end
  end
end

header_set('Content-Type', 'text/plain; charset=utf-8')

ngx_header = setmetatable({}, {
  __index = function(_, k)
    local lower = string.lower(tostring(k)):gsub('_', '-')
    local entry = header_data[lower]
    if entry then
      return entry.value
    end
    return nil
  end,
  __newindex = function(_, k, v)
    header_set(k, v)
  end,
})

RUNNER.header_list = function()
  local keys = {}
  for lower in pairs(header_data) do
    keys[#keys + 1] = lower
  end
  table.sort(keys)
  local flat = {}
  for _, lower in ipairs(keys) do
    local entry = header_data[lower]
    if type(entry.value) == 'table' then
      for _, item in ipairs(entry.value) do
        flat[#flat + 1] = entry.name
        flat[#flat + 1] = tostring(item)
      end
    else
      flat[#flat + 1] = entry.name
      flat[#flat + 1] = tostring(entry.value)
    end
  end
  return flat
end

local var_static = {
  scheme = 'http',
  host = 'lua.ren',
  http_host = 'lua.ren',
  server_name = 'lua.ren',
  server_port = '80',
  server_protocol = 'HTTP/1.1',
  remote_addr = '127.0.0.1',
  remote_port = '52888',
  request_time = '0.001',
  document_root = '/usr/local/openresty/nginx/html',
  request_id = 'lua-ren-mock-request',
  nginx_version = '1021004',
}
var_static.time_local = os.date('%d/%b/%Y:%H:%M:%S +0800')

ngx_var = setmetatable({}, {
  __index = function(_, k)
    if var_static[k] ~= nil then
      return var_static[k]
    end
    if k == 'request_method' then
      return request_state.method
    elseif k == 'uri' or k == 'document_uri' then
      return request_state.uri
    elseif k == 'request_uri' then
      if request_state.args ~= '' then
        return request_state.uri .. '?' .. request_state.args
      end
      return request_state.uri
    elseif k == 'args' or k == 'query_string' then
      return request_state.args
    elseif k == 'is_args' then
      return request_state.args ~= '' and '?' or ''
    elseif k == 'request_filename' then
      return var_static.document_root .. request_state.uri
    elseif k == 'http_user_agent' then
      return request_state.headers['user-agent']
    elseif k == 'http_referer' then
      return request_state.headers.referer
    elseif k == 'content_type' then
      return request_state.headers['content-type']
    elseif k == 'content_length' then
      local body = request_state.body
      return body and tostring(#body) or nil
    elseif type(k) == 'string' and k:sub(1, 4) == 'arg_' then
      local args = parse_query(request_state.args)
      return args[k:sub(5)]
    end
    return nil
  end,
  __newindex = function(_, k, v)
    var_static[k] = v
  end,
})

ngx_ctx = {}

local ngx_const = {
  OK = 0,
  ERROR = -1,
  AGAIN = -2,
  DONE = -4,
  DECLINED = -5,
  STDERR = 0,
  EMERG = 1,
  ALERT = 2,
  CRIT = 3,
  ERR = 4,
  WARN = 5,
  NOTICE = 6,
  INFO = 7,
  DEBUG = 8,
  HTTP_OK = 200,
  HTTP_CREATED = 201,
  HTTP_ACCEPTED = 202,
  HTTP_NO_CONTENT = 204,
  HTTP_PARTIAL_CONTENT = 206,
  HTTP_MOVED_PERMANENTLY = 301,
  HTTP_MOVED_TEMPORARILY = 302,
  HTTP_SEE_OTHER = 303,
  HTTP_NOT_MODIFIED = 304,
  HTTP_TEMPORARY_REDIRECT = 307,
  HTTP_PERMANENT_REDIRECT = 308,
  HTTP_BAD_REQUEST = 400,
  HTTP_UNAUTHORIZED = 401,
  HTTP_FORBIDDEN = 403,
  HTTP_NOT_FOUND = 404,
  HTTP_NOT_ALLOWED = 405,
  HTTP_REQUEST_TIMEOUT = 408,
  HTTP_CONFLICT = 409,
  HTTP_GONE = 410,
  HTTP_UPGRADE_REQUIRED = 426,
  HTTP_TOO_MANY_REQUESTS = 429,
  HTTP_CLOSE = 444,
  HTTP_INTERNAL_SERVER_ERROR = 500,
  HTTP_NOT_IMPLEMENTED = 501,
  HTTP_BAD_GATEWAY = 502,
  HTTP_SERVICE_UNAVAILABLE = 503,
  HTTP_GATEWAY_TIMEOUT = 504,
}

local ngx_extra = {}
local ngx = setmetatable({}, {
  __index = function(_, k)
    local v = rawget(ngx_extra, k)
    if v ~= nil then
      return v
    end
    if k == 'status' then
      return RUNNER.status
    elseif k == 'header' then
      return ngx_header
    elseif k == 'var' then
      return ngx_var
    elseif k == 'ctx' then
      return ngx_ctx
    end
    return ngx_const[k]
  end,
  __newindex = function(_, k, v)
    if k == 'status' then
      RUNNER.used = true
      RUNNER.status = tonumber(v) or v
    elseif k == 'header' then
      header_reset(v)
    elseif k == 'var' then
      if type(v) == 'table' then
        for kk, vv in pairs(v) do
          var_static[kk] = vv
        end
      end
    elseif k == 'ctx' then
      ngx_ctx = v
    else
      rawset(ngx_extra, k, v)
    end
  end,
})

ngx._VERSION = '0.10.25'
ngx.nginx_version = 1021004
ngx.config = {
  subsystem = 'http',
  nginx_version = 1021004,
  nginx_configure = '--prefix=/usr/local/openresty/nginx --with-http_ssl_module (mock)',
  debug = false,
  prefix = '/usr/local/openresty/nginx/',
  nginx_lua_version = 10025,
  ndk_version = '0.3.2',
  http_lua_version = '0.10.25',
  debug_ssl = false,
}
ngx.arg = { [1] = nil, [2] = false }
ngx.is_subrequest = false
ngx.headers_sent = false

local function ngx_write(text, newline)
  RUNNER.used = true
  if newline then
    append_text(text .. '\n')
    RUNNER.body_parts[#RUNNER.body_parts + 1] = text .. '\n'
  else
    append_text(text)
    RUNNER.body_parts[#RUNNER.body_parts + 1] = text
  end
end

local function concat_args(...)
  local n = select('#', ...)
  local parts = {}
  for i = 1, n do
    parts[i] = todisplay((select(i, ...)))
  end
  return table.concat(parts)
end

ngx.print = function(...)
  ngx_write(concat_args(...), false)
end

ngx.say = function(...)
  ngx_write(concat_args(...), true)
end

ngx.flush = function()
  return true
end

ngx.eof = function()
  return true
end

ngx.send_headers = function()
  ngx.headers_sent = true
  return true
end

ngx.exit = function(status)
  RUNNER.used = true
  if status ~= nil then
    RUNNER.status = tonumber(status) or status
  end
  error('__RUNNER_NGX_EXIT__' .. tostring(status), 0)
end

local LEVEL_NAMES = {
  [0] = 'stderr',
  [1] = 'emerg',
  [2] = 'alert',
  [3] = 'crit',
  [4] = 'error',
  [5] = 'warn',
  [6] = 'notice',
  [7] = 'info',
  [8] = 'debug',
}

ngx.log = function(level, ...)
  local parts = {}
  for i = 1, select('#', ...) do
    parts[i] = todisplay((select(i, ...)))
  end
  emit('[' .. (LEVEL_NAMES[level] or tostring(level)) .. '] ' .. table.concat(parts, ' '), 'stderr')
end

ngx.sleep = function(_)
  -- 浏览器环境无法真正阻塞，忽略等待
end

ngx.get_phase = function()
  return 'content'
end

ngx.on_abort = function()
  return nil, 'ngx.on_abort 在模拟环境中不可用'
end

local clock_base = os.time()
local clock_mono = os.clock()

-- Fengari 的 os.date 不支持 "!" UTC 前缀，这里自行换算
local MONTHS = { 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' }
local WEEKDAYS = { 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' }

local function utc_parts(t)
  local days = math.floor(t / 86400)
  local secs = t - days * 86400
  local z = days + 719468
  local era = math.floor(z / 146097)
  local doe = z - era * 146097
  local yoe = math.floor((doe - math.floor(doe / 1460) + math.floor(doe / 36524) - math.floor(doe / 146096)) / 365)
  local year = yoe + era * 400
  local doy = doe - (365 * yoe + math.floor(yoe / 4) - math.floor(yoe / 100))
  local mp = math.floor((5 * doy + 2) / 153)
  local day = doy - math.floor((153 * mp + 2) / 5) + 1
  local month = mp + (mp < 10 and 3 or -9)
  if month <= 2 then
    year = year + 1
  end
  return year, month, day, math.floor(secs / 3600), math.floor((secs % 3600) / 60), secs % 60, days
end

local function utc_date(t, format)
  local year, month, day, hour, minute, second, days = utc_parts(t)
  local weekday = WEEKDAYS[(days + 4) % 7 + 1]
  if format == 'http' then
    return string.format('%s, %02d %s %04d %02d:%02d:%02d GMT',
      weekday, day, MONTHS[month], year, hour, minute, second)
  elseif format == 'cookie' then
    return string.format('%s, %02d-%s-%02d %02d:%02d:%02d GMT',
      weekday, day, MONTHS[month], year % 100, hour, minute, second)
  end
  return string.format('%04d-%02d-%02d %02d:%02d:%02d', year, month, day, hour, minute, second)
end

ngx.now = function()
  return clock_base + (os.clock() - clock_mono)
end

ngx.update_time = function() end
ngx.time = function()
  return os.time()
end
ngx.today = function()
  return os.date('%Y-%m-%d')
end
ngx.localtime = function()
  return os.date('%Y-%m-%d %H:%M:%S')
end
ngx.utctime = function()
  return utc_date(os.time(), 'plain')
end
ngx.http_time = function(t)
  return utc_date(t, 'http')
end
ngx.cookie_time = function(t)
  return utc_date(t, 'cookie')
end
ngx.parse_http_time = function()
  return nil
end

ngx.escape_uri = escape_uri
ngx.unescape_uri = unescape_uri
ngx.encode_args = encode_args
ngx.decode_args = parse_query
ngx.encode_base64 = encode_base64
ngx.decode_base64 = decode_base64
ngx.md5 = md5_hex
ngx.md5_bin = md5_bin
ngx.crc32_short = crc32
ngx.crc32_long = crc32
ngx.quote_sql_str = function(s)
  return "'" .. tostring(s):gsub("\\", "\\\\"):gsub("'", "\\'"):gsub("\0", "\\0") .. "'"
end

ngx.location = {
  capture = function(uri, opts)
    local target = uri
    if type(uri) == 'table' then
      target = uri.uri
    end
    target = tostring(target or '')
    return {
      status = 200,
      body = '[模拟子请求] ' .. target .. ' => 200 OK',
      header = {
        ['Content-Type'] = 'text/plain; charset=utf-8',
        ['X-Mock'] = 'ngx.location.capture',
      },
      truncated = false,
    }
  end,
}

ngx.worker = {
  pid = function()
    return 9527
  end,
  id = function()
    return 0
  end,
  count = function()
    return 1
  end,
  exiting = function()
    return false
  end,
  get_privileged_agent_count = function()
    return 0
  end,
}

ngx.req = {}
ngx_req = ngx.req

local function ci_headers(src)
  local t = {}
  local lower = {}
  for k, v in pairs(src) do
    t[k] = v
    lower[string.lower(k)] = v
  end
  return setmetatable(t, {
    __index = function(_, k)
      if type(k) == 'string' then
        return lower[string.lower(k)]
      end
      return nil
    end,
  })
end

ngx.req.get_headers = function()
  return ci_headers(request_state.headers)
end

ngx.req.set_header = function(name, value)
  if value == nil then
    request_state.headers[string.lower(name)] = nil
  else
    request_state.headers[string.lower(name)] = value
  end
end

ngx.req.clear_header = function(name)
  request_state.headers[string.lower(name)] = nil
end

ngx.req.get_method = function()
  return request_state.method
end

ngx.req.set_method = function(method)
  request_state.method = tostring(method)
end

ngx.req.get_uri_args = function()
  return parse_query(request_state.args)
end

ngx.req.set_uri_args = function(args)
  if type(args) == 'table' then
    request_state.args = encode_args(args)
  else
    request_state.args = tostring(args)
  end
end

ngx.req.get_uri = function()
  return request_state.uri
end

ngx.req.set_uri = function(uri)
  request_state.uri = tostring(uri)
end

ngx.req.read_body = function()
  if request_state.body == nil then
    request_state.body = ''
  end
end

ngx.req.get_body_data = function()
  return request_state.body
end

ngx.req.set_body_data = function(body)
  request_state.body = tostring(body)
end

ngx.req.get_post_args = function()
  if type(request_state.body) == 'string' then
    return parse_query(request_state.body)
  end
  return {}
end

ngx.req.start_time = function()
  return clock_base
end

ngx.req.http_version = function()
  return request_state.http_version
end

ngx.req.raw_header = function()
  local lines = { request_state.method .. ' ' .. request_state.uri .. ' HTTP/1.1' }
  local keys = {}
  for k in pairs(request_state.headers) do
    keys[#keys + 1] = k
  end
  table.sort(keys)
  for _, k in ipairs(keys) do
    lines[#lines + 1] = k .. ': ' .. tostring(request_state.headers[k])
  end
  return table.concat(lines, '\r\n') .. '\r\n\r\n'
end

ngx.req.is_internal = function()
  return false
end

ngx.req.socket = function()
  return nil, 'ngx.req.socket 在模拟环境中不可用'
end

-- ----------------------------------------------------------------------------
-- ngx.re（PCRE 常用子集 -> Lua 模式）
-- ----------------------------------------------------------------------------
local function pcre_to_lua(pat)
  if type(pat) ~= 'string' then
    return nil, nil, 'regex 必须是字符串'
  end
  local out = {}
  local group_stack = {}
  local captures = 0
  local i = 1
  local len = #pat
  local last_atom = nil

  local function push(atom)
    out[#out + 1] = atom
    last_atom = atom
  end

  local function pop_group(start_index)
    local parts = {}
    for idx = start_index, #out do
      parts[#parts + 1] = out[idx]
    end
    for idx = #out, start_index, -1 do
      out[idx] = nil
    end
    return table.concat(parts)
  end

  -- 去掉开头的内联修饰符 (?i) (?m) (?s) 等
  while true do
    local flags, rest = pat:match('^%(%?([imsUx]+)%)(.*)$')
    if not flags then
      break
    end
    pat = rest
    len = #pat
  end

  local escape_map = {
    d = '%d',
    D = '%D',
    w = '%w',
    W = '%W',
    s = '%s',
    S = '%S',
    a = '%a',
    A = '%A',
    l = '%l',
    u = '%u',
    x = '%x',
    n = '\n',
    t = '\t',
    r = '\r',
    f = '\f',
    v = '\v',
    A = '^',
    z = '$',
    Z = '$',
  }

  while i <= len do
    local c = string.sub(pat, i, i)
    if c == '\\' then
      local nxt = string.sub(pat, i + 1, i + 1)
      if nxt == '' then
        push('%')
        i = i + 1
      elseif nxt == 'A' then
        push('^')
        i = i + 2
      elseif nxt == 'z' or nxt == 'Z' then
        push('$')
        i = i + 2
      elseif nxt == 'b' or nxt == 'B' then
        push('')
        i = i + 2
      elseif nxt == 'p' or nxt == 'P' then
        return nil, nil, '暂不支持 Unicode 属性类 \\p{...}'
      elseif escape_map[nxt] then
        push(escape_map[nxt])
        i = i + 2
      elseif string.match(nxt, '%w') then
        push(nxt)
        i = i + 2
      else
        push('%' .. nxt)
        i = i + 2
      end
    elseif c == '[' then
      local cls = { '[' }
      i = i + 1
      if string.sub(pat, i, i) == '^' then
        cls[#cls + 1] = '^'
        i = i + 1
      end
      if string.sub(pat, i, i) == ']' then
        cls[#cls + 1] = ']'
        i = i + 1
      end
      while i <= len do
        local cc = string.sub(pat, i, i)
        if cc == ']' then
          cls[#cls + 1] = ']'
          i = i + 1
          break
        elseif cc == '\\' then
          local nxt = string.sub(pat, i + 1, i + 1)
          if escape_map[nxt] and nxt ~= 'n' and nxt ~= 't' and nxt ~= 'r' then
            cls[#cls + 1] = escape_map[nxt]
          else
            cls[#cls + 1] = nxt
          end
          i = i + 2
        else
          cls[#cls + 1] = cc
          i = i + 1
        end
      end
      push(table.concat(cls))
    elseif c == '(' then
      local rest = string.sub(pat, i)
      if string.sub(rest, 1, 2) == '(?' then
        if string.sub(rest, 1, 3) == '(?:' then
          group_stack[#group_stack + 1] = { index = #out + 1, capture = false }
          i = i + 3
        elseif string.sub(rest, 1, 3) == '(?=' or string.sub(rest, 1, 3) == '(?!' then
          return nil, nil, '暂不支持正向/负向断言 (?=...) (?!...)'
        elseif string.sub(rest, 1, 3) == '(?<' and string.sub(rest, 1, 4) ~= '(?<=' and string.sub(rest, 1, 4) ~= '(?<!' then
          local name, after = string.match(rest, '^%(%?<([%w_]+)>(.*)$')
          if not name then
            return nil, nil, '无法解析命名捕获组'
          end
          local consumed = 4 + #name
          i = i + consumed
          captures = captures + 1
          group_stack[#group_stack + 1] = { index = #out + 1, capture = true }
        else
          return nil, nil, '暂不支持该 PCRE 扩展语法：' .. string.sub(rest, 1, 3)
        end
      else
        captures = captures + 1
        group_stack[#group_stack + 1] = { index = #out + 1, capture = true }
        i = i + 1
      end
    elseif c == ')' then
      local group = table.remove(group_stack)
      if group then
        local atom = pop_group(group.index)
        push('(' .. atom .. ')')
      else
        push(')')
      end
      i = i + 1
    elseif c == '*' or c == '+' then
      out[#out + 1] = c
      last_atom = (last_atom or '') .. c
      i = i + 1
    elseif c == '?' then
      local prev = out[#out]
      if prev == '*' then
        out[#out] = '-'
        last_atom = (last_atom or ''):sub(1, -2) .. '-'
      elseif prev == '+' or prev == '-' then
        -- 懒惰量词，Lua 模式无法精确表达，保持贪婪
      else
        out[#out + 1] = '?'
        last_atom = (last_atom or '') .. '?'
      end
      i = i + 1
    elseif c == '{' then
      local min, comma, max, consumed = string.match(string.sub(pat, i), '^{(%d+)(,?)(%d*)}()')
      if min and last_atom then
        local atom = table.remove(out)
        local min_n = tonumber(min)
        local repeated = string.rep(atom, min_n)
        if comma == ',' then
          local max_n = max ~= '' and tonumber(max) or nil
          if max_n and max_n > min_n then
            repeated = repeated .. string.rep(atom .. '?', max_n - min_n)
          elseif not max_n then
            repeated = repeated .. atom .. '*'
          end
        end
        out[#out + 1] = repeated
        last_atom = repeated
        i = i + consumed - 1
      else
        push('%{')
        i = i + 1
      end
    elseif c == '|' then
      return nil, nil, 'Lua 模式不支持 PCRE 的分支符 |，请拆分为多次匹配'
    elseif c == '.' then
      push('.')
      i = i + 1
    elseif c == '^' or c == '$' then
      push(c)
      i = i + 1
    else
      push(c)
      i = i + 1
    end
  end

  if #group_stack > 0 then
    return nil, nil, '正则表达式中的括号未闭合'
  end

  return table.concat(out), captures
end

-- 把 OpenResty 风格的美元符号捕获引用（$1 等）转换为 Lua 的 %1
local function normalize_replacement(replace)
  if type(replace) ~= 'string' then
    return replace
  end
  replace = replace:gsub('%$(%d)', '%%%1')
  replace = replace:gsub('%$%{(%w+)%}', '%%%1')
  return replace
end

local function find_captures(subject, regex, opts)
  local lua_pat, captures, err = pcre_to_lua(regex)
  if not lua_pat then
    return nil, err
  end
  local result = { string.find(subject, lua_pat) }
  if result[1] == nil then
    return nil
  end
  local t = {}
  for i = 3, #result do
    t[i - 2] = result[i] == nil and false or result[i]
  end
  return t, nil, captures
end

ngx_re = {
  match = function(subject, regex, _)
    local t, err = find_captures(subject, regex)
    if t == nil and err then
      return nil, err
    end
    return t
  end,
  find = function(subject, regex, _)
    local lua_pat, _, err = pcre_to_lua(regex)
    if not lua_pat then
      return nil, nil, err
    end
    local from, to = string.find(subject, lua_pat)
    if not from then
      return nil
    end
    return from, to
  end,
  sub = function(subject, regex, replace, _)
    local lua_pat, _, err = pcre_to_lua(regex)
    if not lua_pat then
      return nil, err
    end
    local result, count = string.gsub(subject, lua_pat, normalize_replacement(replace), 1)
    return result, nil, count
  end,
  gsub = function(subject, regex, replace, _)
    local lua_pat, _, err = pcre_to_lua(regex)
    if not lua_pat then
      return nil, err
    end
    local result, count = string.gsub(subject, lua_pat, normalize_replacement(replace))
    return result, nil, count
  end,
  gmatch = function(subject, regex, _)
    local lua_pat, captures, err = pcre_to_lua(regex)
    if not lua_pat then
      local failed = err
      return function()
        return nil, failed
      end
    end
    local iter = string.gmatch(subject, lua_pat)
    return function()
      local values = { iter() }
      if #values == 0 then
        return nil
      end
      if captures == 0 then
        return { values[1] }
      end
      for idx = 1, #values do
        if values[idx] == nil then
          values[idx] = false
        end
      end
      return values
    end
  end,
}
ngx.re = ngx_re

-- ----------------------------------------------------------------------------
-- ngx.shared（共享内存字典模拟）
-- ----------------------------------------------------------------------------
local shared_stores = {}

local function get_shared(name)
  name = tostring(name)
  local store = shared_stores[name]
  if store then
    return store
  end
  store = {}
  shared_stores[name] = store
  local api = {}

  local function alive(entry)
    if entry.expire and entry.expire <= os.time() then
      return false
    end
    return true
  end

  function api.get(_, key)
    local entry = store[key]
    if entry and alive(entry) then
      return entry.value
    end
    if entry then
      store[key] = nil
    end
    return nil
  end

  function api.get_stale(_, key)
    local entry = store[key]
    if entry then
      return entry.value
    end
    return nil
  end

  function api.set(_, key, value, exptime)
    if type(key) ~= 'string' then
      return nil, 'key must be a string'
    end
    store[key] = {
      value = value,
      expire = (type(exptime) == 'number' and exptime > 0) and (os.time() + exptime) or nil,
    }
    return true
  end

  api.safe_set = api.set

  function api.add(self, key, value, exptime)
    if api.get(self, key) ~= nil then
      return false, 'exists'
    end
    return api.set(self, key, value, exptime)
  end

  api.safe_add = api.add

  function api.replace(self, key, value, exptime)
    if api.get(self, key) == nil then
      return false, 'not found'
    end
    return api.set(self, key, value, exptime)
  end

  function api.delete(_, key)
    store[key] = nil
    return true
  end

  function api.incr(self, key, amount, init, init_ttl)
    amount = tonumber(amount) or 1
    local current = api.get(self, key)
    if current == nil then
      if init == nil then
        return nil, 'not found'
      end
      current = tonumber(init) or 0
    else
      current = tonumber(current)
      if not current then
        return nil, 'not a number'
      end
    end
    local new_value = current + amount
    local entry = store[key]
    local expire
    if entry and entry.expire then
      expire = entry.expire - os.time()
    elseif init_ttl then
      expire = init_ttl
    end
    api.set(self, key, new_value, expire)
    return new_value
  end

  function api.get_keys(_, max)
    local keys = {}
    for key, entry in pairs(store) do
      if alive(entry) then
        keys[#keys + 1] = key
      end
    end
    table.sort(keys)
    if max and #keys > max then
      local limited = {}
      for idx = 1, max do
        limited[idx] = keys[idx]
      end
      keys = limited
    end
    return keys
  end

  function api.flush_all(_)
    for key in pairs(store) do
      store[key] = nil
    end
    return true
  end

  function api.flush_expired(_)
    for key, entry in pairs(store) do
      if not alive(entry) then
        store[key] = nil
      end
    end
  end

  function api.free_space(_)
    return 1048576
  end

  function api.capacity(_)
    return 1048576
  end

  return api
end

ngx.shared = setmetatable({}, {
  __index = function(_, name)
    return get_shared(name)
  end,
})

-- ----------------------------------------------------------------------------
-- ngx.timer / ngx.thread
-- ----------------------------------------------------------------------------
ngx.timer = {
  at = function(delay, callback, ...)
    if type(callback) ~= 'function' then
      return nil, 'callback 必须是函数'
    end
    local ok, err = pcall(callback, false, ...)
    if not ok then
      emit('[ngx.timer.at] 回调执行出错: ' .. tostring(err), 'stderr')
    end
    return 1, nil
  end,
  every = function(interval, callback, ...)
    return ngx.timer.at(interval, callback, ...)
  end,
  running_count = function()
    return 0
  end,
  pending_count = function()
    return 0
  end,
}

ngx.thread = {
  spawn = function(fn, ...)
    if type(fn) ~= 'function' then
      return nil, 'spawn 需要一个函数'
    end
    local co = coroutine.create(fn)
    local thread = {
      co = co,
      started = false,
      args = table.pack(...),
    }
    return thread
  end,
  wait = function(...)
    local threads = { ... }
    local last_results = nil
    for _, thread in ipairs(threads) do
      if type(thread) == 'table' and thread.co then
        local ok, res
        if thread.started then
          ok, res = coroutine.resume(thread.co)
        else
          thread.started = true
          ok, res = coroutine.resume(thread.co, table.unpack(thread.args, 1, thread.args.n))
        end
        if not ok then
          return nil, res
        end
        if coroutine.status(thread.co) == 'dead' then
          last_results = res
        else
          return nil, 'thread still running（模拟层不支持跨 wait 挂起）'
        end
      end
    end
    if last_results == nil then
      return true
    end
    return true, last_results
  end,
  kill = function(thread, ...)
    return true
  end,
}

_G.ngx = ngx

-- ----------------------------------------------------------------------------
-- 常用 OpenResty 模块的轻量占位
-- ----------------------------------------------------------------------------
package.preload['resty.core'] = function()
  return { version = '0.1.25 (mock)' }
end
package.preload['resty.core.misc'] = function()
  return {}
end
package.preload['resty.core.time'] = function()
  return { update_time = function() end }
end
package.preload['ngx.re'] = function()
  return ngx_re
end
package.preload['table.new'] = function()
  return function(narr, nrec)
    return {}
  end
end
package.preload['table.clear'] = function()
  return function(t)
    for k in pairs(t) do
      t[k] = nil
    end
  end
end

_G.cjson = cjson
_G.cjson_safe = cjson_safe

-- 用户代码开始执行后，记录是否使用过 ngx API
RUNNER.track = true
`;
