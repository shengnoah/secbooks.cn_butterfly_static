/* ============================================================
   Lua 运行器 · 示例代码
   使用 String.raw 保留 Lua 中的反斜杠转义
   ============================================================ */
(function () {
  'use strict';

  var examples = {};

  examples.basic = String.raw`-- Lua 5.3 基础语法（在浏览器中运行）
local name = "Lua"
local version = 5.3
print(string.format("%s %.1f 已启动", name, version))

-- 数值运算
print("1 + 2 =", 1 + 2)
print("整数除法 7 // 2 =", 7 // 2)
print("取余 7 % 3 =", 7 % 3)
print("幂运算 2 ^ 10 =", 2 ^ 10)

-- 字符串与 UTF-8
local text = "中文、English、日本語"
print(text, "字节长度:", #text, "字符长度:", utf8.len(text))
print(("lua"):upper(), ("LUA"):lower(), ("a,b,c"):gsub(",", " | "))

-- 表：数组 + 字典
local user = {
  id = 1001,
  name = "张三",
  tags = { "lua", "openresty", "nginx" },
  score = 98.5,
}
print("用户:", user.name, "标签数:", #user.tags)
for i, tag in ipairs(user.tags) do
  print(i, tag)
end

-- 元表与面向对象
local Point = {}
Point.__index = Point

function Point.new(x, y)
  return setmetatable({ x = x, y = y }, Point)
end

function Point:__tostring()
  return string.format("Point(%d, %d)", self.x, self.y)
end

function Point:len()
  return math.sqrt(self.x * self.x + self.y * self.y)
end

local p = Point.new(3, 4)
print("对象:", tostring(p), "到原点距离:", p:len())

-- pcall 捕获错误
local ok, err = pcall(function()
  error("这是一个被 pcall 捕获的错误")
end)
print("pcall:", ok, err)

return "脚本执行完成"
`;

  examples.table = String.raw`-- 表、迭代器与元表
local users = {
  { name = "Alice", age = 28, role = "admin" },
  { name = "Bob",   age = 24, role = "user"  },
  { name = "Carol", age = 31, role = "user"  },
}

-- 按年龄排序（不修改原表）
local sorted = { table.unpack(users) }
table.sort(sorted, function(a, b) return a.age < b.age end)

print("按年龄排序：")
for _, u in ipairs(sorted) do
  print(string.format("  %-6s %3d  %s", u.name, u.age, u.role))
end

-- 统计每个角色的人数
local roles = {}
for _, u in ipairs(users) do
  roles[u.role] = (roles[u.role] or 0) + 1
end
for role, count in pairs(roles) do
  print("角色", role, "人数", count)
end

-- 元表：只读代理
local data = { hello = "world", list = { 1, 2, 3 } }
local proxy = setmetatable({}, {
  __index = function(_, key)
    print("读取字段:", key)
    return data[key]
  end,
  __newindex = function()
    error("该表是只读的", 2)
  end,
})

print(proxy.hello)
print("列表长度:", #proxy.list)

local ok, err = pcall(function() proxy.hello = "x" end)
print("写入只读表:", ok, err)

-- 序列化（用于调试）
print("inspect:", inspect(users))
`;

  examples.coroutine = String.raw`-- 协程：生产者 / 消费者
local function producer(max)
  for i = 1, max do
    coroutine.yield({ id = i, value = i * i })
  end
  return nil, "生产结束"
end

local co = coroutine.create(producer)
print("初始状态:", coroutine.status(co))

local total = 0
while true do
  local ok, item, reason = coroutine.resume(co, 3)
  if not ok then
    print("协程出错:", item)
    break
  end
  if item == nil then
    print("结束原因:", reason)
    break
  end
  total = total + item.value
  print(string.format("收到任务 #%d，平方 = %d，累计 = %d", item.id, item.value, total))
end
print("最终状态:", coroutine.status(co))

-- wrap：无需手动 resume
local gen = coroutine.wrap(function()
  for i = 1, 3 do
    coroutine.yield("wrap-" .. i)
  end
end)
print(gen(), gen(), gen())

-- 用协程实现简易迭代器
local function range(n)
  return coroutine.wrap(function()
    for i = 1, n do
      coroutine.yield(i)
    end
  end)
end
local sum = 0
for i in range(5) do
  sum = sum + i
end
print("1..5 求和 =", sum)
`;

  examples['string'] = String.raw`-- 字符串与 Lua 模式匹配
local text = "2026-11-01 10:30:00 GET /api/user/9527 200 12ms"

local date, time, method, path, status, cost =
  text:match("^(%d%d%d%d%-%d%d%-%d%d) (%d%d:%d%d:%d%d) (%u+) (%S+) (%d+) (%d+ms)$")

print("日期:", date)
print("时间:", time)
print("方法:", method)
print("路径:", path)
print("状态:", status)
print("耗时:", cost)

-- gmatch 提取所有数字
local numbers = {}
for n in ("a1 b22 c333"):gmatch("%d+") do
  numbers[#numbers + 1] = n
end
print("数字:", table.concat(numbers, ", "))

-- gsub + 函数替换
local masked = ("手机号 13812345678 请保密"):gsub("%d", function()
  return "*"
end)
print(masked)

-- 字符串格式化
print(string.format("|%-8s|%8s|%06.2f|", "left", "right", 3.14159))
print(("  trim me  "):match("^%s*(.-)%s*$"))

-- UTF-8 与字节
local s = "你好，Lua"
print(s, "字节", #s, "字符", utf8.len(s))
for pos, code in utf8.codes(s) do
  io.write(pos, ":", code, " ")
end
print()
print("ASCII 反转:", ("hello"):reverse())
print("重复:", ("ab"):rep(3, "-"))
`;

  examples['openresty-basic'] = String.raw`-- OpenResty / ngx API 模拟（浏览器内运行）
ngx.say("Hello, ", ngx.var.host)
ngx.say("请求方法: ", ngx.req.get_method())
ngx.say("请求 URI: ", ngx.var.request_uri)

-- 查询参数
local args = ngx.req.get_uri_args()
ngx.say("name = ", args.name, "，lang = ", args.lang)

-- 请求头（大小写不敏感）
local headers = ngx.req.get_headers()
ngx.say("User-Agent: ", headers["user-agent"])

-- 响应头与状态码
ngx.header["X-Powered-By"] = "lua.ren playground"
ngx.status = ngx.HTTP_OK

-- 日志（warn / error 会以不同颜色显示在控制台）
ngx.log(ngx.INFO, "这是一条 info 日志")
ngx.log(ngx.WARN, "这是一条 warn 日志，参数 = ", 42)

-- 编码工具
ngx.say("md5(abc) = ", ngx.md5("abc"))
ngx.say("base64 = ", ngx.encode_base64("中文 Hello"))
ngx.say("urlencode = ", ngx.escape_uri("a b&c=中文"))
ngx.say("time = ", ngx.localtime())

-- 模拟子请求
local res = ngx.location.capture("/internal/profile?id=9527")
ngx.say("子请求状态: ", res.status)
ngx.say("子请求内容: ", res.body)

-- 结束请求（后面的代码不会执行）
ngx.exit(ngx.HTTP_OK)
`;

  examples['openresty-json'] = String.raw`-- OpenResty + JSON API
local cjson = require "cjson"

-- 读取 POST 请求体（页面“模拟请求”里可修改）
ngx.req.read_body()
local raw = ngx.req.get_body_data()
local form = ngx.req.get_post_args()

local function respond(status, payload)
  ngx.status = status
  ngx.header["Content-Type"] = "application/json; charset=utf-8"
  ngx.header["X-Request-Id"] = ngx.var.request_id
  ngx.say(cjson.encode(payload))
end

if ngx.req.get_method() ~= "POST" then
  respond(ngx.HTTP_NOT_ALLOWED, {
    code = 405,
    message = "只接受 POST 请求",
  })
  return
end

-- 请求体可能是 JSON，也可能是表单；两者都兼容
local input = cjson.safe.decode(raw or "") or {}
local user = input.user or form.user
local pass = input.pass or form.pass

if not user or not pass then
  respond(ngx.HTTP_BAD_REQUEST, {
    code = 400,
    message = "缺少 user 或 pass 参数",
  })
  return
end

local token = ngx.md5(user .. ":" .. pass .. ":" .. ngx.time())

respond(ngx.HTTP_OK, {
  code = 0,
  message = "登录成功",
  data = {
    user = user,
    token = token,
    roles = { "user", "admin" },
    server_time = ngx.localtime(),
  },
})

ngx.log(ngx.INFO, "用户 ", user, " 登录，token=", token)
`;

  examples['openresty-re'] = String.raw`-- ngx.re 路由匹配（PCRE 常用子集）
local routes = {
  { pattern = [[^/api/users/(\d+)$]],        handler = "user_detail" },
  { pattern = [[^/api/users/(\d+)/posts$]],  handler = "user_posts"  },
  { pattern = [[^/api/([a-z_]+)/(\d+)$]],    handler = "generic_api" },
  { pattern = [[^/static/.+\.(%a+)$]],       handler = "static"     },
}

local uris = {
  "/api/users/9527",
  "/api/users/9527/posts",
  "/api/orders/10086",
  "/static/app.js",
  "/api/users/abc",
  "/not-found",
}

for _, uri in ipairs(uris) do
  local matched = false
  for _, route in ipairs(routes) do
    local m, err = ngx.re.match(uri, route.pattern)
    if err then
      ngx.say("正则错误: ", err)
      break
    end
    if m then
      local captures = {}
      for i = 1, #m do
        captures[#captures + 1] = tostring(m[i])
      end
      ngx.say(string.format("%-26s -> %-12s 参数: %s",
        uri, route.handler, table.concat(captures, ", ")))
      matched = true
      break
    end
  end
  if not matched then
    ngx.say(string.format("%-26s -> 404", uri))
  end
end

-- find：返回起止位置
local from, to = ngx.re.find("hello world", [[o\s+w]])
ngx.say("find: ", from, "-", to)

-- gmatch：逐个匹配
ngx.say("所有数字：")
for m in ngx.re.gmatch("a1 b22 c333", [[([a-z])(\d+)]]) do
  ngx.say("  ", m[1], " => ", m[2])
end

-- gsub：支持 $1 引用
local result, err, count = ngx.re.gsub("2026-11-01", [[(\d+)-(\d+)-(\d+)]], "$3/$2/$1")
ngx.say("日期转换: ", result, "（替换 ", count, " 处）")
`;

  examples['openresty-limit'] = String.raw`-- 共享字典 + 简单限流（固定窗口）
local dict = ngx.shared.rate_limit
local LIMIT = 3
local WINDOW = 60

local function allow(key)
  local count = dict:get(key)
  if count == nil then
    dict:set(key, 1, WINDOW)
    return true, 1
  end
  if count >= LIMIT then
    return false, count
  end
  return true, dict:incr(key, 1)
end

local client = ngx.var.remote_addr

for i = 1, 5 do
  local ok, count = allow(client)
  if ok then
    ngx.say(string.format("请求 %d：放行（本窗口第 %d/%d 次）", i, count, LIMIT))
  else
    ngx.status = ngx.HTTP_TOO_MANY_REQUESTS
    ngx.header["Retry-After"] = WINDOW
    ngx.say(string.format("请求 %d：被限流（已达 %d 次）", i, count))
  end
end

-- 共享字典 API
local cache = ngx.shared.cache
cache:set("user:1001", '{"name":"张三"}', 300)
ngx.log(ngx.INFO, "缓存命中: ", cache:get("user:1001"))
ngx.log(ngx.INFO, "剩余键: ", table.concat(cache:get_keys(), ","))

-- 过期演示（真实环境中会按 TTL 过期）
local stats = ngx.shared.stats
stats:set("visits", 0)
for _ = 1, 10 do
  stats:incr("visits", 1)
end
ngx.say("访问计数: ", stats:get("visits"))
ngx.say("字典容量: ", cache:capacity(), " 字节")
`;

  examples['openresty-timer'] = String.raw`-- 定时器与轻量线程（模拟实现）
local dict = ngx.shared.tasks

ngx.timer.at(0, function(premature)
  ngx.log(ngx.INFO, "timer.at 回调执行，premature = ", tostring(premature))
  dict:set("last_run", ngx.localtime())
end)

ngx.timer.every(10, function()
  ngx.log(ngx.INFO, "timer.every 回调（模拟环境中只会执行一次）")
end)

-- ngx.thread：简化的协作式执行
local function fetch(name, delay)
  ngx.sleep(delay)
  return { name = name, status = 200, body = "result of " .. name }
end

local t1 = ngx.thread.spawn(fetch, "users", 0.01)
local t2 = ngx.thread.spawn(fetch, "orders", 0.02)

local ok, res = ngx.thread.wait(t1, t2)
ngx.say("thread.wait: ", ok)
ngx.say("结果: ", inspect(res))

ngx.say("worker.pid = ", ngx.worker.pid(), "，worker.count = ", ngx.worker.count())
ngx.say("当前阶段: ", ngx.get_phase())
ngx.say("上次任务时间: ", dict:get("last_run"))
`;

  examples.error = String.raw`-- 错误处理与 traceback
local function level3()
  error("level3 主动抛出的错误", 2)
end

local function level2()
  level3()
end

local function level1()
  level2()
end

-- 1) pcall 捕获
local ok, err = pcall(level1)
print("pcall =>", ok)
print("错误信息 =>", err)

-- 2) xpcall + debug.traceback 获取调用栈
local ok2, trace = xpcall(level1, debug.traceback)
print("xpcall =>", ok2)
print(trace)

-- 3) 自定义错误对象
local ok3, obj = pcall(function()
  error({ code = 500, message = "数据库连接失败" })
end)
print("错误对象 =>", ok3, inspect(obj))

-- 4) assert 断言
local ok4, err4 = pcall(function()
  local user = nil
  assert(user, "user 不能为空")
end)
print("assert =>", ok4, err4)

print("未捕获的错误会让脚本中断，并在输出面板显示红色 traceback")
`;

  window.LUA_RUNNER_EXAMPLES = examples;

  // 切换示例时自动应用的模拟请求参数
  window.LUA_RUNNER_EXAMPLE_OPTIONS = {
    'openresty-basic': {
      method: 'GET',
      uri: '/lua-runner/demo?name=OpenResty&lang=zh',
      body: '',
    },
    'openresty-json': {
      method: 'POST',
      uri: '/api/login?from=playground',
      body: 'user=admin&pass=123456',
    },
    'openresty-re': {
      method: 'GET',
      uri: '/api/users/9527',
      body: '',
    },
    'openresty-limit': {
      method: 'GET',
      uri: '/api/orders?page=1',
      body: '',
    },
    'openresty-timer': {
      method: 'GET',
      uri: '/lua-runner/timer',
      body: '',
    },
  };
})();