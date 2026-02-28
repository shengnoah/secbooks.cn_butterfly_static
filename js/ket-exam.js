/**
 * KET单词考试页面脚本
 * 功能：主题选择、加载词汇题库、随机抽题、答题交互、答案判断、解析显示、成绩统计
 */

class KETExamApp {
  constructor() {
    // 配置
    this.config = {
      indexUrl: '/data/ket-vocabulary/index.json',
      questionsBaseUrl: '/data/ket-vocabulary/',
      questionsPerExam: 30
    };

    // 状态
    this.state = {
      categories: [],
      selectedCategories: [],
      allQuestions: [],
      examQuestions: [],
      currentQuestionIndex: 0,
      userAnswers: {},
      completedQuestions: new Set(),
      correctCount: 0,
      wrongCount: 0
    };

    // DOM 元素缓存
    this.elements = {};

    // 主题图标映射
    this.categoryIcons = {
      'daily-life': '🏠',
      'school': '📚',
      'family': '👨‍👩‍👧‍👦',
      'food': '🍔',
      'sports': '⚽',
      'nature': '🌳'
    };

    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    await this.loadIndex();
  }

  cacheElements() {
    this.elements = {
      categorySelection: document.getElementById('category-selection'),
      categoryGrid: document.getElementById('category-grid'),
      loadingContainer: document.getElementById('loading-container'),
      errorContainer: document.getElementById('error-container'),
      examContainer: document.getElementById('exam-container'),
      resultContainer: document.getElementById('result-container'),
      progressBar: document.getElementById('progress-bar'),
      progressText: document.getElementById('progress-text'),
      questionCategory: document.getElementById('question-category'),
      questionDifficulty: document.getElementById('question-difficulty'),
      questionContent: document.getElementById('question-content'),
      optionsContainer: document.getElementById('options-container'),
      explanationSection: document.getElementById('explanation-section'),
      explanationTitle: document.getElementById('explanation-title'),
      explanationContent: document.getElementById('explanation-content'),
      prevBtn: document.getElementById('prev-btn'),
      nextBtn: document.getElementById('next-btn'),
      submitBtn: document.getElementById('submit-btn'),
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

  bindEvents() {
    this.elements.prevBtn?.addEventListener('click', () => this.previousQuestion());
    this.elements.nextBtn?.addEventListener('click', () => this.nextQuestion());
    this.elements.submitBtn?.addEventListener('click', () => this.submitExam());
    this.elements.restartBtn?.addEventListener('click', () => this.restartExam());
    this.elements.retryBtn?.addEventListener('click', () => this.loadIndex());
  }

  async loadIndex() {
    this.showLoading();
    try {
      const response = await fetch(this.config.indexUrl);
      if (!response.ok) throw new Error(`加载索引失败: HTTP ${response.status}`);
      const index = await response.json();
      this.state.categories = index.categories;
      this.showCategorySelection();
    } catch (error) {
      this.showError(error.message);
    }
  }

  showCategorySelection() {
    this.elements.loadingContainer.style.display = 'none';
    this.elements.errorContainer.style.display = 'none';
    this.elements.categorySelection.style.display = 'block';
    this.renderCategoryCards();
  }

  renderCategoryCards() {
    const grid = this.elements.categoryGrid;
    grid.innerHTML = '';
    const allCard = this.createCategoryCard({
      id: 'all',
      name: '全部主题',
      description: '从所有6个主题的300个单词中随机抽取30个',
      file: '',
      question_count: 300
    }, true);
    grid.appendChild(allCard);
    this.state.categories.forEach(category => {
      const card = this.createCategoryCard(category);
      grid.appendChild(card);
    });
  }

  createCategoryCard(category, isAll = false) {
    const card = document.createElement('div');
    card.className = isAll ? 'category-card category-card-all' : 'category-card';
    card.dataset.categoryId = category.id;
    const icon = isAll ? '📖' : (this.categoryIcons[category.id] || '📚');
    card.innerHTML = `
      <div class="category-card-header">
        <span class="category-icon">${icon}</span>
        <span class="category-count">${category.question_count}词</span>
      </div>
      <div class="category-name">${category.name}</div>
      <p class="category-description">${category.description}</p>
    `;
    card.addEventListener('click', () => {
      if (isAll) {
        this.selectAllCategories();
      } else {
        this.toggleCategory(category.id);
      }
    });
    return card;
  }

  selectAllCategories() {
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.remove('selected');
    });
    const allCard = document.querySelector('[data-category-id="all"]');
    allCard.classList.add('selected');
    this.state.selectedCategories = this.state.categories.map(c => c.id);
    this.loadQuestions();
  }

  toggleCategory(categoryId) {
    const allCard = document.querySelector('[data-category-id="all"]');
    allCard.classList.remove('selected');
    const card = document.querySelector(`[data-category-id="${categoryId}"]`);
    const index = this.state.selectedCategories.indexOf(categoryId);
    if (index > -1) {
      this.state.selectedCategories.splice(index, 1);
      card.classList.remove('selected');
    } else {
      this.state.selectedCategories.push(categoryId);
      card.classList.add('selected');
    }
    if (this.state.selectedCategories.length > 0) {
      this.loadQuestions();
    }
  }

  async loadQuestions() {
    this.showLoading();
    try {
      const categoriesToLoad = this.state.selectedCategories.length > 0
        ? this.state.categories.filter(c => this.state.selectedCategories.includes(c.id))
        : this.state.categories;
      const categoryPromises = categoriesToLoad.map(category =>
        fetch(this.config.questionsBaseUrl + category.file)
          .then(res => {
            if (!res.ok) throw new Error(`加载 ${category.name} 失败`);
            return res.json();
          })
          .then(data => data.questions)
      );
      const categoriesData = await Promise.all(categoryPromises);
      this.state.allQuestions = categoriesData.flat();
      if (this.state.allQuestions.length === 0) throw new Error('题库中没有题目');
      this.startExam();
    } catch (error) {
      this.showError(error.message);
    }
  }

  startExam() {
    this.state.currentQuestionIndex = 0;
    this.state.userAnswers = {};
    this.state.completedQuestions.clear();
    this.state.correctCount = 0;
    this.state.wrongCount = 0;
    const shuffled = [...this.state.allQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const questionsToTake = Math.min(this.config.questionsPerExam, shuffled.length);
    this.state.examQuestions = shuffled.slice(0, questionsToTake);
    this.showExam();
    this.renderQuestion();
  }

  renderQuestion() {
    const question = this.getCurrentQuestion();
    if (!question) return;
    this.updateProgress();
    this.elements.questionCategory.textContent = question.category;
    this.elements.questionDifficulty.textContent = this.getDifficultyText(question.difficulty);
    this.elements.questionDifficulty.className = `question-difficulty difficulty-${question.difficulty}`;
    this.elements.questionContent.textContent = `${this.state.currentQuestionIndex + 1}. ${question.question}`;
    this.renderOptions(question);
    if (this.state.completedQuestions.has(question.id)) {
      this.showExplanation(question, this.state.userAnswers[question.id]);
    } else {
      this.hideExplanation();
    }
    this.updateNavigationButtons();
  }

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

  createOptionElement(option, userAnswer, isCompleted, correctAnswer) {
    const div = document.createElement('div');
    div.className = 'option-item';
    div.dataset.key = option.key;
    div.innerHTML = `
      <span class="option-key">${option.key}</span>
      <span class="option-text">${option.text}</span>
    `;
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
    if (!isCompleted) {
      div.addEventListener('click', () => this.selectAnswer(option.key));
    }
    return div;
  }

  selectAnswer(answerKey) {
    const question = this.getCurrentQuestion();
    if (!question || this.state.completedQuestions.has(question.id)) return;
    this.state.userAnswers[question.id] = answerKey;
    this.state.completedQuestions.add(question.id);
    if (answerKey === question.answer) {
      this.state.correctCount++;
    } else {
      this.state.wrongCount++;
    }
    this.renderOptions(question);
    this.showExplanation(question, answerKey);
  }

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
    let contentHtml = '';
    if (explanation.correct) {
      contentHtml += `<p><strong>正确解析：</strong><span class="correct-answer">${explanation.correct}</span></p>`;
    }
    if (!isCorrect && explanation.wrong && explanation.wrong[userAnswer]) {
      contentHtml += `<p><strong>错误原因：</strong><span class="wrong-answer">${explanation.wrong[userAnswer]}</span></p>`;
    }
    this.elements.explanationContent.innerHTML = contentHtml;
  }

  hideExplanation() {
    this.elements.explanationSection.className = 'explanation-section';
  }

  previousQuestion() {
    if (this.state.currentQuestionIndex > 0) {
      this.state.currentQuestionIndex--;
      this.renderQuestion();
    }
  }

  nextQuestion() {
    const maxIndex = this.state.examQuestions.length - 1;
    if (this.state.currentQuestionIndex < maxIndex) {
      this.state.currentQuestionIndex++;
      this.renderQuestion();
    }
  }

  submitExam() {
    this.showResults();
  }

  showResults() {
    const total = this.state.examQuestions.length;
    const correct = this.state.correctCount;
    const wrong = this.state.wrongCount;
    const score = Math.round((correct / total) * 100);
    const accuracy = Math.round((correct / total) * 100);
    this.elements.examContainer.classList.remove('active');
    this.elements.resultContainer.classList.add('active');
    let iconClass, icon, title, subtitle;
    if (score >= 90) {
      iconClass = 'excellent';
      icon = '🎉';
      title = '优秀！';
      subtitle = '你的词汇掌握得非常好，继续保持！';
    } else if (score >= 80) {
      iconClass = 'excellent';
      icon = '👍';
      title = '很好！';
      subtitle = '词汇掌握得不错，继续努力！';
    } else if (score >= 60) {
      iconClass = 'good';
      icon = '😊';
      title = '及格了！';
      subtitle = '还有提升空间，多加练习！';
    } else {
      iconClass = 'poor';
      icon = '💪';
      title = '需要努力！';
      subtitle = '建议多复习这些单词，再试一次！';
    }
    this.elements.resultIcon.className = `result-icon ${iconClass}`;
    this.elements.resultIcon.textContent = icon;
    this.elements.resultTitle.textContent = title;
    this.elements.resultSubtitle.textContent = subtitle;
    this.elements.scoreValue.textContent = `${score}分`;
    this.elements.correctValue.textContent = correct;
    this.elements.wrongValue.textContent = wrong;
    this.elements.accuracyValue.textContent = `${accuracy}%`;
  }

  restartExam() {
    this.elements.resultContainer.classList.remove('active');
    this.elements.categorySelection.style.display = 'block';
    this.state.selectedCategories = [];
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.remove('selected');
    });
  }

  updateProgress() {
    const current = this.state.currentQuestionIndex + 1;
    const total = this.state.examQuestions.length;
    const percentage = (current / total) * 100;
    this.elements.progressBar.style.width = `${percentage}%`;
    this.elements.progressText.textContent = `单词 ${current} / ${total}`;
  }

  updateNavigationButtons() {
    const currentIndex = this.state.currentQuestionIndex;
    const total = this.state.examQuestions.length;
    this.elements.prevBtn.disabled = currentIndex === 0;
    if (currentIndex === total - 1) {
      this.elements.nextBtn.style.display = 'none';
      this.elements.submitBtn.style.display = 'inline-block';
    } else {
      this.elements.nextBtn.style.display = 'inline-block';
      this.elements.submitBtn.style.display = 'none';
    }
  }

  getCurrentQuestion() {
    return this.state.examQuestions[this.state.currentQuestionIndex];
  }

  getDifficultyText(difficulty) {
    const map = {
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    };
    return map[difficulty] || difficulty;
  }

  showLoading() {
    this.elements.loadingContainer.style.display = 'block';
    this.elements.errorContainer.style.display = 'none';
    this.elements.categorySelection.style.display = 'none';
    this.elements.examContainer.classList.remove('active');
    this.elements.resultContainer.classList.remove('active');
  }

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

  showExam() {
    this.elements.loadingContainer.style.display = 'none';
    this.elements.errorContainer.style.display = 'none';
    this.elements.categorySelection.style.display = 'none';
    this.elements.examContainer.classList.add('active');
    this.elements.resultContainer.classList.remove('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new KETExamApp();
});
