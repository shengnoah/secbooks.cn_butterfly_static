// BASIC 语言解释器
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  const basicInput = document.getElementById('basic-input');
  const basicOutput = document.getElementById('basic-output');
  const runBtn = document.getElementById('run-basic');
  const clearBtn = document.getElementById('clear-basic');
  const exampleBtn = document.getElementById('example-basic');
  const clearOutputBtn = document.getElementById('clear-output');

  if (!basicInput || !basicOutput || !runBtn) {
    console.error('BASIC 运行器初始化失败：缺少必要元素');
    return;
  }

  // BASIC 解释器类
  class BasicInterpreter {
    constructor() {
      this.variables = {};
      this.lines = {};
      this.output = [];
      this.programCounter = 0;
      this.lineNumbers = [];
      this.forStack = [];
      this.running = false;
    }

    reset() {
      this.variables = {};
      this.lines = {};
      this.output = [];
      this.programCounter = 0;
      this.lineNumbers = [];
      this.forStack = [];
      this.running = false;
    }

    addOutput(text, type = 'normal') {
      this.output.push({ text, type });
    }

    parse(code) {
      this.reset();
      const lines = code.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('REM') || trimmed.startsWith("'")) {
          continue;
        }

        const match = trimmed.match(/^(\d+)\s+(.+)$/);
        if (match) {
          const lineNum = parseInt(match[1]);
          const statement = match[2].trim();
          this.lines[lineNum] = statement;
        } else if (trimmed) {
          // 无行号的直接执行语句
          this.lines[9999] = trimmed;
        }
      }

      this.lineNumbers = Object.keys(this.lines).map(Number).sort((a, b) => a - b);
    }

    async run() {
      this.running = true;
      this.programCounter = 0;

      try {
        while (this.programCounter < this.lineNumbers.length && this.running) {
          const lineNum = this.lineNumbers[this.programCounter];
          const statement = this.lines[lineNum];
          
          await this.executeStatement(statement, lineNum);
          this.programCounter++;
        }
      } catch (error) {
        this.addOutput(`错误: ${error.message}`, 'error');
      }

      return this.output;
    }

    async executeStatement(statement, lineNum) {
      const cmd = statement.toUpperCase();

      // PRINT 语句
      if (cmd.startsWith('PRINT ')) {
        const expr = statement.substring(6).trim();
        const value = this.evaluateExpression(expr);
        this.addOutput(value);
      }
      // LET 语句
      else if (cmd.startsWith('LET ')) {
        const assignment = statement.substring(4).trim();
        this.executeAssignment(assignment);
      }
      // 直接赋值（无 LET）
      else if (statement.match(/^[A-Za-z]\w*\s*=/)) {
        this.executeAssignment(statement);
      }
      // INPUT 语句
      else if (cmd.startsWith('INPUT ')) {
        const varName = statement.substring(6).trim().replace(/[";]/g, '');
        const value = prompt(`请输入 ${varName} 的值:`);
        if (value !== null) {
          this.variables[varName.toUpperCase()] = isNaN(value) ? value : parseFloat(value);
        }
      }
      // IF 语句
      else if (cmd.startsWith('IF ')) {
        this.executeIf(statement);
      }
      // GOTO 语句
      else if (cmd.startsWith('GOTO ')) {
        const targetLine = parseInt(statement.substring(5).trim());
        const index = this.lineNumbers.indexOf(targetLine);
        if (index !== -1) {
          this.programCounter = index - 1; // -1 因为循环会 +1
        } else {
          throw new Error(`行号 ${targetLine} 不存在`);
        }
      }
      // FOR 语句
      else if (cmd.startsWith('FOR ')) {
        this.executeFor(statement, lineNum);
      }
      // NEXT 语句
      else if (cmd.startsWith('NEXT')) {
        this.executeNext(statement);
      }
      // END 语句
      else if (cmd === 'END') {
        this.running = false;
      }
      // CLS 清屏
      else if (cmd === 'CLS') {
        this.output = [];
      }
    }

    executeAssignment(statement) {
      const parts = statement.split('=');
      if (parts.length !== 2) {
        throw new Error('赋值语句格式错误');
      }
      
      const varName = parts[0].trim().toUpperCase();
      const value = this.evaluateExpression(parts[1].trim());
      this.variables[varName] = value;
    }

    executeIf(statement) {
      // IF condition THEN statement
      const match = statement.match(/IF\s+(.+?)\s+THEN\s+(.+)/i);
      if (!match) {
        throw new Error('IF 语句格式错误');
      }

      const condition = match[1].trim();
      const thenPart = match[2].trim();

      if (this.evaluateCondition(condition)) {
        // 如果是 GOTO，跳转
        if (thenPart.toUpperCase().startsWith('GOTO ')) {
          const targetLine = parseInt(thenPart.substring(5).trim());
          const index = this.lineNumbers.indexOf(targetLine);
          if (index !== -1) {
            this.programCounter = index - 1;
          }
        } else {
          // 否则执行语句
          this.executeStatement(thenPart, 0);
        }
      }
    }

    executeFor(statement, lineNum) {
      // FOR I = 1 TO 10 [STEP 1]
      const match = statement.match(/FOR\s+([A-Za-z]\w*)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i);
      if (!match) {
        throw new Error('FOR 语句格式错误');
      }

      const varName = match[1].toUpperCase();
      const startValue = this.evaluateExpression(match[2].trim());
      const endValue = this.evaluateExpression(match[3].trim());
      const stepValue = match[4] ? this.evaluateExpression(match[4].trim()) : 1;

      this.variables[varName] = startValue;
      this.forStack.push({
        varName,
        endValue,
        stepValue,
        lineIndex: this.programCounter
      });
    }

    executeNext(statement) {
      if (this.forStack.length === 0) {
        throw new Error('NEXT 语句没有对应的 FOR');
      }

      const forInfo = this.forStack[this.forStack.length - 1];
      this.variables[forInfo.varName] += forInfo.stepValue;

      const current = this.variables[forInfo.varName];
      const shouldContinue = forInfo.stepValue > 0 
        ? current <= forInfo.endValue 
        : current >= forInfo.endValue;

      if (shouldContinue) {
        this.programCounter = forInfo.lineIndex;
      } else {
        this.forStack.pop();
      }
    }

    evaluateCondition(condition) {
      // 支持 =, <>, <, >, <=, >=
      const operators = ['<=', '>=', '<>', '<', '>', '='];
      
      for (const op of operators) {
        if (condition.includes(op)) {
          const parts = condition.split(op);
          if (parts.length === 2) {
            const left = this.evaluateExpression(parts[0].trim());
            const right = this.evaluateExpression(parts[1].trim());
            
            switch (op) {
              case '=': return left === right;
              case '<>': return left !== right;
              case '<': return left < right;
              case '>': return left > right;
              case '<=': return left <= right;
              case '>=': return left >= right;
            }
          }
        }
      }
      
      throw new Error('条件表达式格式错误');
    }

    evaluateExpression(expr) {
      expr = expr.trim();

      // 字符串字面量
      if (expr.startsWith('"') && expr.endsWith('"')) {
        return expr.slice(1, -1);
      }

      // 变量
      if (/^[A-Za-z]\w*$/.test(expr)) {
        const varName = expr.toUpperCase();
        return this.variables[varName] !== undefined ? this.variables[varName] : 0;
      }

      // 数字
      if (!isNaN(expr)) {
        return parseFloat(expr);
      }

      // 表达式计算
      try {
        // 替换变量
        let evalExpr = expr;
        for (const varName in this.variables) {
          const regex = new RegExp('\\b' + varName + '\\b', 'gi');
          evalExpr = evalExpr.replace(regex, this.variables[varName]);
        }
        
        // 安全的数学表达式求值
        return Function('"use strict"; return (' + evalExpr + ')')();
      } catch (error) {
        throw new Error(`表达式求值错误: ${expr}`);
      }
    }
  }

  // 运行 BASIC 代码
  async function runBasic() {
    const code = basicInput.value.trim();
    if (!code) {
      showMessage('请输入 BASIC 代码', 'error');
      return;
    }

    basicOutput.textContent = '';
    const interpreter = new BasicInterpreter();
    
    try {
      interpreter.parse(code);
      const output = await interpreter.run();
      
      if (output.length === 0) {
        basicOutput.textContent = '程序执行完成（无输出）';
      } else {
        output.forEach(item => {
          const line = document.createElement('div');
          line.className = `output-line ${item.type === 'error' ? 'output-error' : ''}`;
          line.textContent = item.text;
          basicOutput.appendChild(line);
        });
      }
      
      showMessage('程序执行完成', 'success');
    } catch (error) {
      basicOutput.textContent = `错误: ${error.message}`;
      showMessage('程序执行出错', 'error');
    }
  }

  // 清空代码
  function clearBasic() {
    basicInput.value = '';
    basicOutput.textContent = '';
    showMessage('已清空', 'success');
  }

  // 清空输出
  function clearOutput() {
    basicOutput.textContent = '';
  }

  // 加载示例代码
  function loadExample() {
    const example = `10 REM 计算 1 到 10 的和
20 LET SUM = 0
30 FOR I = 1 TO 10
40 LET SUM = SUM + I
50 PRINT "当前 I = "; I; ", 累计和 = "; SUM
60 NEXT I
70 PRINT "最终结果: "; SUM
80 END`;

    basicInput.value = example;
    showMessage('已加载示例代码', 'success');
  }

  // 显示消息
  function showMessage(message, type) {
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
  runBtn.addEventListener('click', runBasic);
  clearBtn.addEventListener('click', clearBasic);
  exampleBtn.addEventListener('click', loadExample);
  clearOutputBtn.addEventListener('click', clearOutput);

  // 快捷键支持
  basicInput.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runBasic();
    }
  });

  // 加载默认示例
  loadExample();
});
