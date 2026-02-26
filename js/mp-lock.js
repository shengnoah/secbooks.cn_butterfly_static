/**
 * Butterfly - MP Lock Script
 * 文章阅读全文需关注公众号解锁
 *
 * 兼容性说明：
 * - 避免可选链/async-await/尾逗号等新语法
 * - WebCrypto（crypto.subtle）不可用时，使用纯 JS 的 SHA-256 兜底
 */

'use strict'

/**
 * 纯 JS SHA-256（ES5）
 * 说明：
 * - 不依赖 WebCrypto/HTTPS
 * - 返回 64 位 hex（标准 SHA-256）
 */
function sha256Js(message) {
  // SHA-256 常量（FIPS 180-4）
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]

  var H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)) }
  function ch(x, y, z) { return (x & y) ^ (~x & z) }
  function maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z) }
  function s0(x) { return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22) }
  function s1(x) { return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25) }
  function g0(x) { return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3) }
  function g1(x) { return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10) }

  // UTF-8 encode -> bytes
  function toBytes(str) {
    str = String(str)
    var bytes = []
    var i = 0
    while (i < str.length) {
      var c = str.charCodeAt(i++)
      // surrogate pair
      if (c >= 0xD800 && c <= 0xDBFF && i < str.length) {
        var c2 = str.charCodeAt(i)
        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
          i++
          c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00)
        }
      }
      if (c < 0x80) bytes.push(c)
      else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F))
      else if (c < 0x10000) bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F))
      else bytes.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F))
    }
    return bytes
  }

  var bytes = toBytes(message)
  var bitLenHi = 0
  var bitLenLo = (bytes.length * 8) >>> 0
  // 对于非常长的输入（> 2^29 bytes），需要处理高位，这里按兼容场景足够（口令很短）。

  // padding: append 0x80, then 0x00 until length ≡ 56 (mod 64)
  bytes.push(0x80)
  while ((bytes.length % 64) !== 56) bytes.push(0x00)

  // append 64-bit length big-endian
  bytes.push((bitLenHi >>> 24) & 0xFF, (bitLenHi >>> 16) & 0xFF, (bitLenHi >>> 8) & 0xFF, bitLenHi & 0xFF)
  bytes.push((bitLenLo >>> 24) & 0xFF, (bitLenLo >>> 16) & 0xFF, (bitLenLo >>> 8) & 0xFF, bitLenLo & 0xFF)

  var W = new Array(64)

  for (var offset = 0; offset < bytes.length; offset += 64) {
    // 16 words
    for (var i = 0; i < 16; i++) {
      var j = offset + (i * 4)
      W[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | (bytes[j + 3])) >>> 0
    }
    // extend
    for (i = 16; i < 64; i++) {
      W[i] = (g1(W[i - 2]) + W[i - 7] + g0(W[i - 15]) + W[i - 16]) >>> 0
    }

    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]

    for (i = 0; i < 64; i++) {
      var t1 = (h + s1(e) + ch(e, f, g) + K[i] + W[i]) >>> 0
      var t2 = (s0(a) + maj(a, b, c)) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }

    H[0] = (H[0] + a) >>> 0
    H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0
    H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0
    H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0
    H[7] = (H[7] + h) >>> 0
  }

  function toHex32(x) {
    var s = (x >>> 0).toString(16)
    return ('00000000' + s).slice(-8)
  }

  return (
    toHex32(H[0]) + toHex32(H[1]) + toHex32(H[2]) + toHex32(H[3]) +
    toHex32(H[4]) + toHex32(H[5]) + toHex32(H[6]) + toHex32(H[7])
  )
}

// SHA-256：优先 WebCrypto；失败则用纯 JS 兜底
function sha256(message) {
  return new Promise(function (resolve) {
    try {
      var subtle = window.crypto && window.crypto.subtle
      if (subtle && subtle.digest && typeof TextEncoder !== 'undefined') {
        var msgBuffer = new TextEncoder().encode(String(message))
        return subtle.digest('SHA-256', msgBuffer).then(function (hashBuffer) {
          try {
            var hashArray = Array.prototype.slice.call(new Uint8Array(hashBuffer))
            var hashHex = hashArray.map(function (b) {
              var s = b.toString(16)
              return s.length === 1 ? '0' + s : s
            }).join('')
            resolve(hashHex)
          } catch (e) {
            resolve(sha256Js(message))
          }
        }).catch(function () {
          resolve(sha256Js(message))
        })
      }
    } catch (e) {
      // ignore
    }

    // fallback
    resolve(sha256Js(message))
  })
}

function getMpLockConfig() {
  return (window.GLOBAL_CONFIG && window.GLOBAL_CONFIG.mpLock) ? window.GLOBAL_CONFIG.mpLock : null
}

function safeTrim(str) {
  str = String(str || '')
  if (str && typeof str.trim === 'function') return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

// 检查是否已解锁
function isUnlocked() {
  var config = getMpLockConfig()
  if (!config) return false

  var storageKey = config.storageKey || 'mp_lock_code'
  try {
    var unlockedCode = localStorage.getItem(storageKey)
    return !!unlockedCode
  } catch (e) {
    return false
  }
}

// 解锁：返回 Promise<boolean>
function unlock(code) {
  var config = getMpLockConfig()
  if (!config) return Promise.resolve(false)

  var storageKey = config.storageKey || 'mp_lock_code'
  var keysHash = config.keysHash || []

  if (!keysHash.length) {
    try { localStorage.setItem(storageKey, 'unlocked') } catch (e) {}
    return Promise.resolve(true)
  }

  var codeStr = safeTrim(code)

  return sha256(codeStr).then(function (inputHash) {
    if (keysHash.indexOf(inputHash) !== -1) {
      try { localStorage.setItem(storageKey, inputHash) } catch (e) {}
      return true
    }
    return false
  })
}

function popupError(text) {
  try {
    if (window.GLOBAL_CONFIG && window.GLOBAL_CONFIG.Snackbar !== undefined && typeof btf !== 'undefined' && btf.snackbarShow) {
      btf.snackbarShow(text)
    }
  } catch (e) {}

  try { window.alert(text) } catch (e) {}
}

function showMessage(container, type, text) {
  if (!container) return
  var errorEl = container.querySelector('.mp-lock-message-error')
  var successEl = container.querySelector('.mp-lock-message-success')
  if (!errorEl || !successEl) return

  if (type === 'error') {
    errorEl.textContent = text
    errorEl.classList.add('mp-lock-message-show')
    successEl.classList.remove('mp-lock-message-show')
  } else if (type === 'success') {
    successEl.textContent = text
    successEl.classList.add('mp-lock-message-show')
    errorEl.classList.remove('mp-lock-message-show')
  }
}

function hideMessages(container) {
  if (!container) return
  var errorEl = container.querySelector('.mp-lock-message-error')
  var successEl = container.querySelector('.mp-lock-message-success')
  if (!errorEl || !successEl) return
  errorEl.classList.remove('mp-lock-message-show')
  successEl.classList.remove('mp-lock-message-show')
}

function showFullContent(container) {
  if (!container) return
  var lockedContent = container.querySelector('.mp-lock-locked-content')
  var card = container.querySelector('.mp-lock-card')
  var divider = container.querySelector('.mp-lock-divider')
  var preview = container.querySelector('.mp-lock-content')

  if (lockedContent) {
    lockedContent.classList.remove('mp-lock-hidden')
    lockedContent.classList.add('mp-lock-unlocked')
  }

  // 解锁后隐藏预览区域，避免内容和 mermaid 图重复显示
  if (preview) preview.style.display = 'none'

  if (card) card.style.display = 'none'
  if (divider) divider.style.display = 'none'
}

function initMpLock() {
  var container = document.querySelector('.mp-lock-container')
  if (!container) return

  if (container.getAttribute('data-mp-lock-inited') === 'true') return
  container.setAttribute('data-mp-lock-inited', 'true')

  var config = getMpLockConfig()
  if (!config) return

  if (isUnlocked()) {
    showFullContent(container)
    return
  }

  var submitBtn = container.querySelector('.mp-lock-submit')
  var inputEl = container.querySelector('.mp-lock-input')
  if (!submitBtn || !inputEl) return

  submitBtn.setAttribute('type', 'button')

  submitBtn.addEventListener('click', function () {
    hideMessages(container)

    var code = safeTrim(inputEl.value)
    if (!code) {
      var emptyMsg = config.errorMessage || '请输入解锁口令'
      showMessage(container, 'error', emptyMsg)
      popupError(emptyMsg)
      try { inputEl.focus() } catch (e) {}
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = '验证中...'

    unlock(code).then(function (success) {
      if (success) {
        showMessage(container, 'success', config.successMessage || '解锁成功')
        setTimeout(function () { showFullContent(container) }, 500)
      } else {
        var msg = config.errorMessage || '口令错误，请重新输入'
        showMessage(container, 'error', msg)
        popupError(msg)

        submitBtn.disabled = false
        submitBtn.textContent = config.submitText || '解锁'

        try {
          inputEl.focus()
          inputEl.select()
        } catch (e) {}
      }
    }).catch(function () {
      var msg2 = '解锁校验失败，请刷新页面后重试'
      showMessage(container, 'error', msg2)
      popupError(msg2)
      submitBtn.disabled = false
      submitBtn.textContent = config.submitText || '解锁'
    })
  })

  inputEl.addEventListener('keydown', function (e) {
    e = e || window.event
    var key = e.key || e.keyCode
    if (key === 'Enter' || key === 13) submitBtn.click()
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMpLock)
} else {
  initMpLock()
}

try {
  window.addEventListener('pjax:complete', initMpLock)
  window.addEventListener('pjax:end', initMpLock)
  document.addEventListener('pjax:complete', initMpLock)
  document.addEventListener('pjax:end', initMpLock)
} catch (e) {}
