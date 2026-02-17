#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const BOARD_PATH = path.join(__dirname, '..', 'MISSION_BOARD.md');
const LOCK_FILE = path.join(__dirname, '.board-lock');

class MissionBoard {
  constructor() {
    this.tasks = [];
    this.loadBoard();
  }

  loadBoard() {
    try {
      if (fs.existsSync(BOARD_PATH)) {
        const content = fs.readFileSync(BOARD_PATH, 'utf8');
        this.parseBoard(content);
      }
    } catch (err) {
      console.error(chalk.red('Error loading board:'), err.message);
    }
  }

  parseBoard(content) {
    // Parse existing tasks from markdown
    const taskRegex = /\[([ x])\]\s*(TASK-\d+):\s*"([^"]+)"\s*→\s*([^\n]+)/g;
    let match;
    while ((match = taskRegex.exec(content)) !== null) {
      this.tasks.push({
        id: match[2],
        status: match[1] === 'x' ? 'completed' : 'active',
        title: match[3],
        assignee: this.detectAssignee(match[4]),
        lastUpdate: Date.now()
      });
    }
  }

  detectAssignee(context) {
    if (context.includes('GLM-5')) return 'GLM-5';
    if (context.includes('Kimi')) return 'Kimi K2.5';
    if (context.includes('Mistral')) return 'Mistral Large';
    if (context.includes('Groq')) return 'Groq Llama';
    return 'Unassigned';
  }

  acquireLock() {
    if (fs.existsSync(LOCK_FILE)) {
      const lockTime = fs.statSync(LOCK_FILE).mtime;
      const age = Date.now() - lockTime.getTime();
      if (age < 30000) { // 30 second lock
        console.log(chalk.yellow('⚠️  Mission board locked by another process. Retrying...'));
        return false;
      }
    }
    fs.writeFileSync(LOCK_FILE, Date.now().toString());
    return true;
  }

  releaseLock() {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  }

  addTask(id, title, assignee) {
    if (!this.acquireLock()) return false;
    
    this.tasks.push({
      id,
      title,
      assignee,
      status: 'active',
      created: new Date().toISOString(),
      urgency: 'high'
    });
    
    this.saveBoard();
    this.releaseLock();
    console.log(chalk.green(`✅ Added ${id}: ${title}`));
    return true;
  }

  completeTask(id) {
    if (!this.acquireLock()) return false;
    
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      this.saveBoard();
      console.log(chalk.green(`✅ Completed ${id}`));
    } else {
      console.log(chalk.red(`❌ Task ${id} not found`));
    }
    
    this.releaseLock();
  }

  generateBoard() {
    const now = new Date().toISOString();
    let md = `# MISSION BOARD - LIVE STATUS\n\n`;
    md += `**Last Updated:** ${now}  \n`;
    md += `**Active Agents:** Kimi K2.5, GLM-5, Mistral Large, Groq Llama  \n\n`;
    
    md += `## 🚨 CRITICAL (Fix Delays NOW)\n\n`;
    
    const active = this.tasks.filter(t => t.status === 'active');
    const completed = this.tasks.filter(t => t.status === 'completed');
    
    if (active.length === 0) {
      md += `- [ ] TASK-${Date.now().toString().slice(-3)}: "Optimize board update speed" → Kimi K2.5 (AUTO-GENERATED)\n`;
    }
    
    active.forEach(task => {
      md += `- [ ] ${task.id}: "${task.title}" → ${task.assignee} (${task.urgency || 'normal'} priority)\n`;
    });
    
    md += `\n## ✅ COMPLETED (Last 24h)\n\n`;
    completed.slice(-10).forEach(task => {
      md += `- [x] ${task.id}: "${task.title}" → ${task.assignee}\n`;
    });
    
    md += `\n## ⚡ SPEED PROTOCOLS\n\n`;
    md += `1. **No Lock Contention:** Use atomic writes with 30s timeout\n`;
    md += `2. **Parallel Processing:** Agents work on separate files, merge via this tool\n`;
    md += `3. **Auto-Status:** Run \\`npm run status\\` every 60s to sync\n`;
    md += `4. **Immediate Writes:** No batching—update board on every state change\n\n`;
    
    return md;
  }

  saveBoard() {
    const content = this.generateBoard();
    fs.writeFileSync(BOARD_PATH, content);
  }

  showStatus() {
    console.log(chalk.blue.bold('\n=== MISSION BOARD STATUS ===\n'));
    console.log(chalk.white(`Total Tasks: ${this.tasks.length}`));
    console.log(chalk.yellow(`Active: ${this.tasks.filter(t => t.status === 'active').length}`));
    console.log(chalk.green(`Completed: ${this.tasks.filter(t => t.status === 'completed').length}`));
    
    if (fs.existsSync(LOCK_FILE)) {
      console.log(chalk.red('\n⚠️  BOARD IS LOCKED'));
    } else {
      console.log(chalk.green('\n✅ Board ready for updates'));
    }
    console.log('');
  }
}

// CLI Handler
const args = process.argv.slice(2);
const board = new MissionBoard();

if (args.includes('--status')) {
  board.showStatus();
} else if (args.includes('--complete')) {
  const taskId = args[args.indexOf('--complete') + 1];
  if (taskId) board.completeTask(taskId);
} else if (args.includes('--add')) {
  const title = args[args.indexOf('--add') + 1];
  const assignee = args[args.indexOf('--assignee') + 1] || 'Auto';
  const id = `TASK-${Date.now().toString().slice(-3)}`;
  board.addTask(id, title, assignee);
} else {
  board.showStatus();
  console.log(chalk.gray('Usage:'));
  console.log(chalk.gray('  npm run status       - Show current status'));
  console.log(chalk.gray('  npm run update       - Force refresh board'));
  console.log(chalk.gray('  node index.js --add "Task name" --assignee "Agent"'));
}