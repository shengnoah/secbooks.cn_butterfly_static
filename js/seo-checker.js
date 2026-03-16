// SEO Checker JavaScript
document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('url-input');
  const checkBtn = document.getElementById('check-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const resultContainer = document.getElementById('result-container');
  const exportBtn = document.getElementById('export-report');
  const clearBtn = document.getElementById('clear-result');

  let currentResult = null;

  if (!checkBtn) return;

  checkBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
      alert('请输入网址');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert('请输入完整的网址（包含 http:// 或 https://）');
      return;
    }

    loadingIndicator.style.display = 'block';
    resultContainer.style.display = 'none';
    checkBtn.disabled = true;
    checkBtn.textContent = '检测中...';

    try {
      await checkSEO(url);
    } catch (error) {
      alert('检测失败：' + error.message);
      console.error('SEO检测错误:', error);
    } finally {
      loadingIndicator.style.display = 'none';
      checkBtn.disabled = false;
      checkBtn.textContent = '开始检测';
    }
  });

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      checkBtn.click();
    }
  });

  async function checkSEO(url) {
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      
      if (!data.contents) {
        throw new Error('无法获取页面内容');
      }

      const html = data.contents;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const result = analyzeSEO(doc, url);
      currentResult = result;
      displayResult(result);
      resultContainer.style.display = 'block';
    } catch (error) {
      throw new Error('无法访问该网址，可能存在跨域限制');
    }
  }

  function analyzeSEO(doc, url) {
    const result = {
      url: url,
      timestamp: new Date().toLocaleString('zh-CN'),
      basic: {},
      meta: {},
      headings: {},
      images: {},
      links: {},
      score: 0
    };

    result.basic.title = doc.title || '未设置';
    result.basic.titleLength = doc.title ? doc.title.length : 0;
    result.basic.charset = doc.characterSet || '未检测到';
    result.basic.lang = doc.documentElement.lang || '未设置';

    const metaDesc = doc.querySelector('meta[name="description"]');
    result.meta.description = metaDesc ? metaDesc.content : '未设置';
    result.meta.descLength = metaDesc ? metaDesc.content.length : 0;

    const metaKeywords = doc.querySelector('meta[name="keywords"]');
    result.meta.keywords = metaKeywords ? metaKeywords.content : '未设置';

    const metaViewport = doc.querySelector('meta[name="viewport"]');
    result.meta.viewport = metaViewport ? '已设置' : '未设置';

    const ogTitle = doc.querySelector('meta[property="og:title"]');
    result.meta.ogTitle = ogTitle ? ogTitle.content : '未设置';

    const ogDesc = doc.querySelector('meta[property="og:description"]');
    result.meta.ogDescription = ogDesc ? ogDesc.content : '未设置';

    for (let i = 1; i <= 6; i++) {
      const headings = doc.querySelectorAll(`h${i}`);
      result.headings[`h${i}`] = headings.length;
    }

    const images = doc.querySelectorAll('img');
    result.images.total = images.length;
    result.images.withoutAlt = Array.from(images).filter(img => !img.alt).length;
    result.images.withAlt = result.images.total - result.images.withoutAlt;

    const links = doc.querySelectorAll('a');
    result.links.total = links.length;
    result.links.internal = Array.from(links).filter(a => {
      const href = a.href;
      return href && (href.startsWith('/') || href.includes(new URL(url).hostname));
    }).length;
    result.links.external = result.links.total - result.links.internal;
    result.links.nofollow = doc.querySelectorAll('a[rel*="nofollow"]').length;

    result.score = calculateSEOScore(result);

    return result;
  }

  function calculateSEOScore(result) {
    let score = 0;
    const checks = [];

    if (result.basic.title && result.basic.title !== '未设置') {
      if (result.basic.titleLength >= 10 && result.basic.titleLength <= 60) {
        score += 20;
        checks.push({ name: '页面标题', status: 'good', message: '标题长度适中' });
      } else {
        score += 10;
        checks.push({ name: '页面标题', status: 'warning', message: '标题长度不理想' });
      }
    } else {
      checks.push({ name: '页面标题', status: 'error', message: '未设置标题' });
    }

    if (result.meta.description && result.meta.description !== '未设置') {
      if (result.meta.descLength >= 50 && result.meta.descLength <= 160) {
        score += 20;
        checks.push({ name: 'Meta描述', status: 'good', message: '描述长度适中' });
      } else {
        score += 10;
        checks.push({ name: 'Meta描述', status: 'warning', message: '描述长度不理想' });
      }
    } else {
      checks.push({ name: 'Meta描述', status: 'error', message: '未设置描述' });
    }

    if (result.headings.h1 === 1) {
      score += 15;
      checks.push({ name: 'H1标签', status: 'good', message: '有且仅有一个H1标签' });
    } else if (result.headings.h1 > 1) {
      score += 5;
      checks.push({ name: 'H1标签', status: 'warning', message: 'H1标签过多' });
    } else {
      checks.push({ name: 'H1标签', status: 'error', message: '缺少H1标签' });
    }

    if (result.images.total > 0) {
      const altRatio = result.images.withAlt / result.images.total;
      if (altRatio >= 0.9) {
        score += 15;
        checks.push({ name: '图片Alt属性', status: 'good', message: '大部分图片有Alt' });
      } else if (altRatio >= 0.5) {
        score += 8;
        checks.push({ name: '图片Alt属性', status: 'warning', message: '部分图片缺少Alt' });
      } else {
        score += 3;
        checks.push({ name: '图片Alt属性', status: 'error', message: '大量图片缺少Alt' });
      }
    } else {
      score += 15;
      checks.push({ name: '图片Alt属性', status: 'good', message: '无图片' });
    }

    if (result.meta.viewport && result.meta.viewport !== '未设置') {
      score += 10;
      checks.push({ name: '移动端适配', status: 'good', message: '已设置Viewport' });
    } else {
      checks.push({ name: '移动端适配', status: 'error', message: '未设置Viewport' });
    }

    if (result.basic.lang && result.basic.lang !== '未设置') {
      score += 10;
      checks.push({ name: '语言设置', status: 'good', message: '已设置语言' });
    } else {
      checks.push({ name: '语言设置', status: 'warning', message: '未设置语言' });
    }

    if (result.meta.ogTitle !== '未设置' && result.meta.ogDescription !== '未设置') {
      score += 10;
      checks.push({ name: 'Open Graph', status: 'good', message: '已设置OG标签' });
    } else {
      checks.push({ name: 'Open Graph', status: 'warning', message: 'OG标签不完整' });
    }

    result.checks = checks;
    return Math.min(score, 100);
  }

  function displayResult(result) {
    document.getElementById('basic-info').innerHTML = `
      <div class="info-item">
        <span class="info-label">页面标题:</span>
        <span class="info-value">${result.basic.title}</span>
      </div>
      <div class="info-item">
        <span class="info-label">标题长度:</span>
        <span class="info-value ${result.basic.titleLength >= 10 && result.basic.titleLength <= 60 ? 'good' : 'warning'}">${result.basic.titleLength} 字符</span>
      </div>
      <div class="info-item">
        <span class="info-label">字符编码:</span>
        <span class="info-value">${result.basic.charset}</span>
      </div>
      <div class="info-item">
        <span class="info-label">页面语言:</span>
        <span class="info-value">${result.basic.lang}</span>
      </div>
    `;

    document.getElementById('meta-info').innerHTML = `
      <div class="info-item full-width">
        <span class="info-label">Meta描述:</span>
        <span class="info-value">${result.meta.description}</span>
      </div>
      <div class="info-item">
        <span class="info-label">描述长度:</span>
        <span class="info-value ${result.meta.descLength >= 50 && result.meta.descLength <= 160 ? 'good' : 'warning'}">${result.meta.descLength} 字符</span>
      </div>
      <div class="info-item full-width">
        <span class="info-label">Meta关键词:</span>
        <span class="info-value">${result.meta.keywords}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Viewport:</span>
        <span class="info-value ${result.meta.viewport === '已设置' ? 'good' : 'error'}">${result.meta.viewport}</span>
      </div>
      <div class="info-item full-width">
        <span class="info-label">OG标题:</span>
        <span class="info-value">${result.meta.ogTitle}</span>
      </div>
      <div class="info-item full-width">
        <span class="info-label">OG描述:</span>
        <span class="info-value">${result.meta.ogDescription}</span>
      </div>
    `;

    let headingHTML = '';
    for (let i = 1; i <= 6; i++) {
      const count = result.headings[`h${i}`];
      const statusClass = i === 1 ? (count === 1 ? 'good' : count > 1 ? 'warning' : 'error') : '';
      headingHTML += `
        <div class="info-item">
          <span class="info-label">H${i} 标签:</span>
          <span class="info-value ${statusClass}">${count} 个</span>
        </div>
      `;
    }
    document.getElementById('heading-info').innerHTML = headingHTML;

    const imgAltRatio = result.images.total > 0 ? (result.images.withAlt / result.images.total * 100).toFixed(1) : 100;
    document.getElementById('image-info').innerHTML = `
      <div class="info-item">
        <span class="info-label">图片总数:</span>
        <span class="info-value">${result.images.total}</span>
      </div>
      <div class="info-item">
        <span class="info-label">有Alt属性:</span>
        <span class="info-value good">${result.images.withAlt}</span>
      </div>
      <div class="info-item">
        <span class="info-label">无Alt属性:</span>
        <span class="info-value ${result.images.withoutAlt > 0 ? 'error' : 'good'}">${result.images.withoutAlt}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Alt覆盖率:</span>
        <span class="info-value ${imgAltRatio >= 90 ? 'good' : imgAltRatio >= 50 ? 'warning' : 'error'}">${imgAltRatio}%</span>
      </div>
    `;

    document.getElementById('link-info').innerHTML = `
      <div class="info-item">
        <span class="info-label">链接总数:</span>
        <span class="info-value">${result.links.total}</span>
      </div>
      <div class="info-item">
        <span class="info-label">内部链接:</span>
        <span class="info-value">${result.links.internal}</span>
      </div>
      <div class="info-item">
        <span class="info-label">外部链接:</span>
        <span class="info-value">${result.links.external}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Nofollow链接:</span>
        <span class="info-value">${result.links.nofollow}</span>
      </div>
    `;

    const scoreClass = result.score >= 80 ? 'excellent' : result.score >= 60 ? 'good' : result.score >= 40 ? 'fair' : 'poor';
    const scoreText = result.score >= 80 ? '优秀' : result.score >= 60 ? '良好' : result.score >= 40 ? '一般' : '较差';
    
    let checksHTML = result.checks.map(check => `
      <div class="check-item ${check.status}">
        <span class="check-icon">${check.status === 'good' ? '✓' : check.status === 'warning' ? '⚠' : '✗'}</span>
        <span class="check-name">${check.name}</span>
        <span class="check-message">${check.message}</span>
      </div>
    `).join('');

    document.getElementById('seo-score').innerHTML = `
      <div class="score-display ${scoreClass}">
        <div class="score-number">${result.score}</div>
        <div class="score-text">${scoreText}</div>
      </div>
      <div class="checks-list">
        ${checksHTML}
      </div>
    `;
  }

  exportBtn?.addEventListener('click', () => {
    if (!currentResult) {
      alert('请先进行SEO检测');
      return;
    }

    const report = `SEO检测报告
==========================================
检测时间: ${currentResult.timestamp}
检测网址: ${currentResult.url}
SEO评分: ${currentResult.score}/100

基本信息
------------------------------------------
页面标题: ${currentResult.basic.title}
标题长度: ${currentResult.basic.titleLength} 字符
字符编码: ${currentResult.basic.charset}
页面语言: ${currentResult.basic.lang}

Meta标签
------------------------------------------
Meta描述: ${currentResult.meta.description}
描述长度: ${currentResult.meta.descLength} 字符
Meta关键词: ${currentResult.meta.keywords}
Viewport: ${currentResult.meta.viewport}
OG标题: ${currentResult.meta.ogTitle}
OG描述: ${currentResult.meta.ogDescription}

标题标签
------------------------------------------
H1: ${currentResult.headings.h1} 个
H2: ${currentResult.headings.h2} 个
H3: ${currentResult.headings.h3} 个
H4: ${currentResult.headings.h4} 个
H5: ${currentResult.headings.h5} 个
H6: ${currentResult.headings.h6} 个

图片优化
------------------------------------------
图片总数: ${currentResult.images.total}
有Alt属性: ${currentResult.images.withAlt}
无Alt属性: ${currentResult.images.withoutAlt}

链接分析
------------------------------------------
链接总数: ${currentResult.links.total}
内部链接: ${currentResult.links.internal}
外部链接: ${currentResult.links.external}
Nofollow链接: ${currentResult.links.nofollow}

检测项目
------------------------------------------
${currentResult.checks.map(check => `${check.name}: ${check.message}`).join('\n')}

==========================================
报告生成时间: ${new Date().toLocaleString('zh-CN')}`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    anchor.href = url;
    anchor.download = `seo-report-${timestamp}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  });

  clearBtn?.addEventListener('click', () => {
    urlInput.value = '';
    resultContainer.style.display = 'none';
    currentResult = null;
  });
});
