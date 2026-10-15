/**
 * 软考高项考试页面脚本
 * 功能：领域选择、加载题库、随机抽题、答题交互、答案判断、解析显示、成绩统计
 */

class ExamApp {
  constructor() {
    // 配置
    this.config = {
      indexUrl: '/data/questions/index.json',  // 题库索引文件
      questionsBaseUrl: '/data/questions/',     // 题库文件基础路径
      questionsPerExam: 30  // 每次考试抽取的题目数量
    };

    // 状态
    this.state = {
      categories: [],        // 所有类别
      selectedCategories: [], // 选中的类别
      allQuestions: [],      // 所有题目
      examQuestions: [],     // 当前考试的题目
      currentQuestionIndex: 0, // 当前题目索引
      userAnswers: {},       // 用户答案 { questionId: answerKey }
      completedQuestions: new Set(), // 已完成的题目
      correctCount: 0,      // 正确数量
      wrongCount: 0         // 错误数量
    };

    // DOM 元素缓存
    this.elements = {};

    // 类别图标映射
    this.categoryIcons = {
      'integration': '🎯',
      'scope': '📋',
      'schedule': '⏰',
      'cost': '💰',
      'quality': '✨',
      'resource': '👥',
      'communication': '💬',
      'risk': '⚠️',
      'procurement': '🛒',
      'stakeholder': '🤝'
    };

    // 初始化
    this.init();
  }

  /**
   * 初始化应用
   */
  async init() {
    this.cacheElements();
    this.bindEvents();
    await this.loadIndex();
  }

  /**
   * 缓存DOM元素
   */
  cacheElements() {
    this.elements = {
      categorySelection: document.getElementById('category-selection'),
      categoryGrid: document.getElementById('category-grid'),
      loadingContainer: document.getElementById('loading-container'),
      errorContainer: document.getElementById('error-container'),
      examContainer: document.getElementById('exam-container'),
      resultContainer: document.getElementById('result-container'),

      // 进度相关
      progressBar: document.getElementById('progress-bar'),
      progressText: document.getElementById('progress-text'),

      // 题目相关
      questionCategory: document.getElementById('question-category'),
      questionDifficulty: document.getElementById('question-difficulty'),
      questionContent: document.getElementById('question-content'),
      optionsContainer: document.getElementById('options-container'),
      explanationSection: document.getElementById('explanation-section'),
      explanationTitle: document.getElementById('explanation-title'),
      explanationContent: document.getElementById('explanation-content'),

      // 导航按钮
      prevBtn: document.getElementById('prev-btn'),
      nextBtn: document.getElementById('next-btn'),
      submitBtn: document.getElementById('submit-btn'),

      // 结果相关
      resultIcon: document.getElementById('result-icon'),
      resultTitle: document.getElementById('result-title'),
      resultSubtitle: document.getElementById('result-subtitle'),
      scoreValue: document.getElementById('score-value'),
      correctValue: document.getElementById('correct-value'),
      wrongValue: document.getElementById('wrong-value'),
      accuracyValue: document.getElementById('accuracy-value'),
      restartBtn: document.getElementById('restart-btn'),
      retryBtn: document.getElementById('retry-btn')
    };
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    this.elements.prevBtn?.addEventListener('click', () => this.previousQuestion());
    this.elements.nextBtn?.addEventListener('click', () => this.nextQuestion());
    this.elements.submitBtn?.addEventListener('click', () => this.submitExam());
    this.elements.restartBtn?.addEventListener('click', () => this.restartExam());
    this.elements.retryBtn?.addEventListener('click', () => this.loadIndex());
  }

  /**
   * 加载题库索引
   */
  async loadIndex() {
    this.showLoading();

    try {
      console.log('正在加载题库索引...');
      const response = await fetch(this.config.indexUrl);
      
      if (!response.ok) {
        throw new Error(`加载索引失败: HTTP ${response.status}`);
      }

      const index = await response.json();
      this.state.categories = index.categories;
      
      console.log(`✓ 索引加载成功，发现 ${index.categories.length} 个类别`);

      // 显示类别选择界面
      this.showCategorySelection();
    } catch (error) {
      console.error('加载索引失败:', error);
      this.showError(error.message);
    }
  }

  /**
   * 显示类别选择界面
   */
  showCategorySelection() {
    this.elements.loadingContainer.style.display = 'none';
    this.elements.errorContainer.style.display = 'none';
    this.elements.categorySelection.style.display = 'block';

    // 渲染类别卡片
    this.renderCategoryCards();
  }

  /**
   * 渲染类别卡片
   */
  renderCategoryCards() {
    const grid = this.elements.categoryGrid;
    grid.innerHTML = '';

    // 添加"全部领域"选项
    const allCard = this.createCategoryCard({
      id: 'all',
      name: '全部领域',
      description: '从所有10个知识领域的300道题中随机抽取30题',
      file: '',
      question_count: 300
    }, true);
    grid.appendChild(allCard);

    // 添加各个领域
    this.state.categories.forEach(category => {
      const card = this.createCategoryCard({
        ...category,
        question_count: 30
      });
      grid.appendChild(card);
    });
  }

  /**
   * 创建类别卡片
   */
  createCategoryCard(category, isAll = false) {
    const card = document.createElement('div');
    card.className = isAll ? 'category-card category-card-all' : 'category-card';
    card.dataset.categoryId = category.id;

    const icon = isAll ? '🎓' : (this.categoryIcons[category.id] || '📚');

    card.innerHTML = `
      <div class="category-card-header">
        <span class="category-icon">${icon}</span>
        <span class="category-count">${category.question_count}题</span>
      </div>
      <div class="category-name">${category.name}</div>
      <p class="category-description">${category.description}</p>
    `;

    // 点击事件
    card.addEventListener('click', () => {
      if (isAll) {
        // 选择全部领域
        this.selectAllCategories();
      } else {
        // 选择单个领域
        this.toggleCategory(category.id);
      }
    });

    return card;
  }

  /**
   * 选择全部领域
   */
  selectAllCategories() {
    // 清除所有选中状态
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.remove('selected');
    });

    // 选中"全部领域"
    const allCard = document.querySelector('[data-category-id="all"]');
    allCard.classList.add('selected');

    // 设置选中的类别为所有类别
    this.state.selectedCategories = this.state.categories.map(c => c.id);

    // 开始考试
    this.loadQuestions();
  }

  /**
   * 切换类别选择
   */
  toggleCategory(categoryId) {
    // 取消"全部领域"的选中
    const allCard = document.querySelector('[data-category-id="all"]');
    allCard.classList.remove('selected');

    const card = document.querySelector(`[data-category-id="${categoryId}"]`);
    const index = this.state.selectedCategories.indexOf(categoryId);

    if (index > -1) {
      // 取消选中
      this.state.selectedCategories.splice(index, 1);
      card.classList.remove('selected');
    } else {
      // 选中
      this.state.selectedCategories.push(categoryId);
      card.classList.add('selected');
    }

    // 如果选中了类别，开始考试
    if (this.state.selectedCategories.length > 0) {
      this.loadQuestions();
    }
  }

  /**
   * 加载题库 - 支持多文件加载
   */
  async loadQuestions() {
    this.showLoading();

    try {
      // 确定要加载的类别
      const categoriesToLoad = this.state.selectedCategories.length > 0
        ? this.state.categories.filter(c => this.state.selectedCategories.includes(c.id))
        : this.state.categories;

      console.log(`正在加载 ${categoriesToLoad.length} 个类别的题库...`);

      // 并行加载所有分类文件
      const categoryPromises = categoriesToLoad.map(category =>
        fetch(this.config.questionsBaseUrl + category.file)
          .then(res => {
            if (!res.ok) {
              throw new Error(`加载 ${category.name} 失败`);
            }
            return res.json();
          })
          .then(data => {
            console.log(`✓ ${category.name}: ${data.questions.length} 题`);
            return data.questions;
          })
      );

      const categoriesData = await Promise.all(categoryPromises);

      // 合并所有题目
      this.state.allQuestions = categoriesData.flat();

      if (this.state.allQuestions.length === 0) {
        throw new Error('题库中没有题目');
      }

      console.log(`✓ 题库加载完成，共 ${this.state.allQuestions.length} 道题`);

      // 随机抽取题目并开始考试
      this.startExam();
    } catch (error) {
      console.error('加载题库失败:', error);
      this.showError(error.message);
    }
  }

  /**
   * 开始考试 - 随机抽取题目
   */
  startExam() {
    // 重置状态
    this.state.currentQuestionIndex = 0;
    this.state.userAnswers = {};
    this.state.completedQuestions.clear();
    this.state.correctCount = 0;
    this.state.wrongCount = 0;

    // 随机抽取题目（Fisher-Yates 洗牌算法）
    const shuffled = [...this.state.allQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 取前N道题作为考试题目
    const questionsToTake = Math.min(this.config.questionsPerExam, shuffled.length);
    this.state.examQuestions = shuffled.slice(0, questionsToTake);

    console.log(`✓ 已随机抽取 ${this.state.examQuestions.length} 道题`);

    // 显示考试界面并渲染第一题
    this.showExam();
    this.renderQuestion();
  }

  /**
   * 渲染当前题目
   */
  renderQuestion() {
    const question = this.getCurrentQuestion();
    if (!question) return;

    // 更新进度
    this.updateProgress();

    // 更新题目元信息
    this.elements.questionCategory.textContent = question.category;
    this.elements.questionDifficulty.textContent = this.getDifficultyText(question.difficulty);
    this.elements.questionDifficulty.className = `question-difficulty difficulty-${question.difficulty}`;
    this.elements.questionContent.textContent = `${this.state.currentQuestionIndex + 1}. ${question.question}`;

    // 渲染选项
    this.renderOptions(question);

    // 更新解析区域
    if (this.state.completedQuestions.has(question.id)) {
      this.showExplanation(question, this.state.userAnswers[question.id]);
    } else {
      this.hideExplanation();
    }

    // 更新导航按钮状态
    this.updateNavigationButtons();
  }

  /**
   * 渲染选项
   */
  renderOptions(question) {
    const container = this.elements.optionsContainer;
    container.innerHTML = '';

    const userAnswer = this.state.userAnswers[question.id];
    const isCompleted = this.state.completedQuestions.has(question.id);

    question.options.forEach(option => {
      const optionEl = this.createOptionElement(option, userAnswer, isCompleted, question.answer);
      container.appendChild(optionEl);
    });
  }

  /**
   * 创建选项元素
   */
  createOptionElement(option, userAnswer, isCompleted, correctAnswer) {
    const div = document.createElement('div');
    div.className = 'option-item';
    div.dataset.key = option.key;

    // 添加选项内容
    div.innerHTML = `
      <span class="option-key">${option.key}</span>
      <span class="option-text">${option.text}</span>
    `;

    // 设置状态样式
    if (isCompleted) {
      div.classList.add('disabled');
      
      if (option.key === correctAnswer) {
        div.classList.add('correct');
        div.innerHTML += '<span class="option-result-icon">✓</span>';
      } else if (option.key === userAnswer) {
        div.classList.add('wrong');
        div.innerHTML += '<span class="option-result-icon">✗</span>';
      }
    } else if (userAnswer === option.key) {
      div.classList.add('selected');
    }

    // 绑定点击事件
    if (!isCompleted) {
      div.addEventListener('click', () => this.selectAnswer(option.key));
    }

    return div;
  }

  /**
   * 选择答案
   */
  selectAnswer(answerKey) {
    const question = this.getCurrentQuestion();
    if (!question || this.state.completedQuestions.has(question.id)) return;

    // 保存用户答案
    this.state.userAnswers[question.id] = answerKey;
    this.state.completedQuestions.add(question.id);

    // 判断对错
    if (answerKey === question.answer) {
      this.state.correctCount++;
    } else {
      this.state.wrongCount++;
    }

    // 重新渲染选项（显示答案状态）
    this.renderOptions(question);

    // 显示解析
    this.showExplanation(question, answerKey);
  }

  /**
   * 显示答案解析
   */
  showExplanation(question, userAnswer) {
    const isCorrect = userAnswer === question.answer;
    const explanation = question.explanation;

    this.elements.explanationSection.className = `explanation-section show ${isCorrect ? 'correct' : 'wrong'}`;

    let titleHtml = '';
    if (isCorrect) {
      titleHtml = '<span class="icon">✓</span> <span>回答正确！</span>';
    } else {
      titleHtml = `<span class="icon">✗</span> <span>回答错误，正确答案是 ${question.answer}</span>`;
    }

    this.elements.explanationTitle.innerHTML = titleHtml;

    // 构建解析内容
    let contentHtml = '';

    if (explanation.correct) {
      contentHtml += `<p><strong>正确原因：</strong><span class="correct-answer">${explanation.correct}</span></p>`;
    }

    if (!isCorrect && explanation.wrong && explanation.wrong[userAnswer]) {
      contentHtml += `<p><strong>错误原因：</strong><span class="wrong-answer">${explanation.wrong[userAnswer]}</span></p>`;
    }

    this.elements.explanationContent.innerHTML = contentHtml;
  }

  /**
   * 隐藏解析区域
   */
  hideExplanation() {
    this.elements.explanationSection.className = 'explanation-section';
  }

  /**
   * 上一题
   */
  previousQuestion() {
    if (this.state.currentQuestionIndex > 0) {
      this.state.currentQuestionIndex--;
      this.renderQuestion();
    }
  }

  /**
   * 下一题
   */
  nextQuestion() {
    const maxIndex = this.state.examQuestions.length - 1;
    if (this.state.currentQuestionIndex < maxIndex) {
      this.state.currentQuestionIndex++;
      this.renderQuestion();
    }
  }

  /**
   * 提交考试
   */
  submitExam() {
    this.showResults();
  }

  /**
   * 显示结果
   */
  showResults() {
    const total = this.state.examQuestions.length;
    const correct = this.state.correctCount;
    const wrong = this.state.wrongCount;
    const score = Math.round((correct / total) * 100);
    const accuracy = Math.round((correct / total) * 100);

    // 隐藏考试界面，显示结果
    this.elements.examContainer.classList.remove('active');
    this.elements.resultContainer.classList.add('active');

    // 根据分数设置图标和标题
    let iconClass, icon, title, subtitle;
    
    if (score >= 80) {
      iconClass = 'excellent';
      icon = '🎉';
      title = '太棒了！';
      subtitle = '你已经掌握了大部分知识点，继续保持！';
    } else if (score >= 60) {
      iconClass = 'good';
      icon = '👍';
      title = '及格了！';
      subtitle = '还有提升空间，继续加油！';
    } else {
      iconClass = 'poor';
      icon = '💪';
      title = '需要努力！';
      subtitle = '建议复习相关知识点，再试一次！';
    }

    this.elements.resultIcon.className = `result-icon ${iconClass}`;
    this.elements.resultIcon.textContent = icon;
    this.elements.resultTitle.textContent = title;
    this.elements.resultSubtitle.textContent = subtitle;

    // 更新统计数据
    this.elements.scoreValue.textContent = `${score}分`;
    this.elements.correctValue.textContent = correct;
    this.elements.wrongValue.textContent = wrong;
    this.elements.accuracyValue.textContent = `${accuracy}%`;
  }

  /**
   * 重新开始考试
   */
  restartExam() {
    this.elements.resultContainer.classList.remove('active');
    this.elements.categorySelection.style.display = 'block';
    this.state.selectedCategories = [];
    
    // 清除所有选中状态
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.remove('selected');
    });
  }

  /**
   * 更新进度条
   */
  updateProgress() {
    const current = this.state.currentQuestionIndex + 1;
    const total = this.state.examQuestions.length;
    const percentage = (current / total) * 100;

    this.elements.progressBar.style.width = `${percentage}%`;
    this.elements.progressText.textContent = `题目 ${current} / ${total}`;
  }

  /**
   * 更新导航按钮状态
   */
  updateNavigationButtons() {
    const currentIndex = this.state.currentQuestionIndex;
    const total = this.state.examQuestions.length;

    // 上一题按钮
    this.elements.prevBtn.disabled = currentIndex === 0;

    // 下一题/提交按钮
    if (currentIndex === total - 1) {
      this.elements.nextBtn.style.display = 'none';
      this.elements.submitBtn.style.display = 'inline-block';
    } else {
      this.elements.nextBtn.style.display = 'inline-block';
      this.elements.submitBtn.style.display = 'none';
    }
  }

  /**
   * 获取当前题目
   */
  getCurrentQuestion() {
    return this.state.examQuestions[this.state.currentQuestionIndex];
  }

  /**
   * 获取难度文本
   */
  getDifficultyText(difficulty) {
    const map = {
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    };
    return map[difficulty] || difficulty;
  }

  /**
   * 显示加载状态
   */
  showLoading() {
    this.elements.loadingContainer.style.display = 'block';
    this.elements.errorContainer.style.display = 'none';
    this.elements.categorySelection.style.display = 'none';
    this.elements.examContainer.classList.remove('active');
    this.elements.resultContainer.classList.remove('active');
  }

  /**
   * 显示错误状态
   */
  showError(message) {
    this.elements.loadingContainer.style.display = 'none';
    this.elements.errorContainer.style.display = 'block';
    this.elements.categorySelection.style.display = 'none';
    this.elements.examContainer.classList.remove('active');
    this.elements.resultContainer.classList.remove('active');

    const errorText = this.elements.errorContainer.querySelector('.error-message');
    if (errorText) {
      errorText.textContent = `加载失败：${message}`;
    }
  }

  /**
   * 显示考试界面
   */
  showExam() {
    this.elements.loadingContainer.style.display = 'none';
    this.elements.errorContainer.style.display = 'none';
    this.elements.categorySelection.style.display = 'none';
    this.elements.examContainer.classList.add('active');
    this.elements.resultContainer.classList.remove('active');
  }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new ExamApp();
});
