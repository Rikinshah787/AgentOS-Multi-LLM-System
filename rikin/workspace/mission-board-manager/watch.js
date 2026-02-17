const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  watchPaths: [
    '../**/*.js',
    '../**/*.ts',
    '../**/*.py',
    '../**/*.md',
    '../**/*.json',
    '!../node_modules/**',
    '!../.git/**'
  ],
  missionBoardPath: path.join(__dirname, '../MISSION_BOARD.md'),
  updateInterval: 10000, // 10 seconds
  debounceDelay: 1000 // 1 second debounce for file changes
};

class MissionBoardWatcher {
  constructor() {
    this.lastUpdate = Date.now();
    this.pendingUpdate = null;
    this.changeCount = 0;
    this.watcher = null;
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    console.log('🔍 Mission Board Watcher Starting...');
    console.log('📂 Watching paths:', CONFIG.watchPaths.filter(p => !p.startsWith('!')));
    console.log('⏱️  Auto-update interval: 10 seconds');
    console.log('─'.repeat(50));

    // Initialize file watcher
    this.watcher = chokidar.watch(CONFIG.watchPaths, {
      ignored: /node_modules|\.git/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    // Set up event handlers
    this.watcher
      .on('add', (filePath) => this.handleChange('added', filePath))
      .on('change', (filePath) => this.handleChange('changed', filePath))
      .on('unlink', (filePath) => this.handleChange('deleted', filePath))
      .on('error', (error) => this.handleError(error));

    // Start periodic updates
    this.intervalId = setInterval(() => {
      this.periodicUpdate();
    }, CONFIG.updateInterval);

    this.isRunning = true;
    console.log('✅ Watcher active. Press Ctrl+C to stop.\n');
    
    // Initial update
    this.updateMissionBoard('initial');
  }

  handleChange(eventType, filePath) {
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    console.log(`📝 File ${eventType}: ${relativePath}`);
    this.changeCount++;

    // Debounce rapid changes
    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
    }

    this.pendingUpdate = setTimeout(() => {
      this.updateMissionBoard(eventType);
      this.pendingUpdate = null;
    }, CONFIG.debounceDelay);
  }

  periodicUpdate() {
    const timeSinceLastUpdate = Date.now() - this.lastUpdate;
    
    if (timeSinceLastUpdate >= CONFIG.updateInterval) {
      console.log('\n⏰ Periodic update triggered (10s interval)');
      this.updateMissionBoard('periodic');
    }
  }

  updateMissionBoard(reason) {
    const timestamp = new Date().toISOString();
    console.log(`\n🔄 Updating mission board [${reason}] - ${timestamp}`);
    
    try {
      // Generate mission board content
      const content = this.generateMissionBoardContent();
      
      // Write to file
      fs.writeFileSync(CONFIG.missionBoardPath, content, 'utf8');
      
      this.lastUpdate = Date.now();
      console.log('✅ Mission board updated successfully');
      console.log(`📊 Total changes detected this session: ${this.changeCount}`);
      
    } catch (error) {
      console.error('❌ Error updating mission board:', error.message);
    }
  }

  generateMissionBoardContent() {
    const now = new Date();
    const timestamp = now.toISOString();
    const localTime = now.toLocaleString();

    // Scan for project files
    const projectStats = this.scanProjectFiles();
    
    // Get git status if available
    const gitStatus = this.getGitStatus();

    return `# 🚀 MISSION BOARD

> **Last Auto-Updated:** ${localTime}  
> **Update Interval:** 10 seconds  
> **Watcher Status:** ✅ Active  
> **Changes This Session:** ${this.changeCount}

---

## 📊 Project Statistics

| Metric | Count |
|--------|-------|
| JavaScript Files | ${projectStats.js} |
| TypeScript Files | ${projectStats.ts} |
| Python Files | ${projectStats.py} |
| Markdown Files | ${projectStats.md} |
| JSON Configs | ${projectStats.json} |
| **Total Files** | **${projectStats.total}** |

---

## 🔄 Recent Activity

${this.getRecentActivity()}

---

## 📁 Project Structure

\`\`\`
${this.getProjectTree()}
\`\`\`

---

## 🌿 Git Status

${gitStatus}

---

## ⚡ Quick Actions

| Action | Command |
|--------|---------|
| Start Watcher | \`npm run watch\` |
| Manual Update | \`npm start\` |
| Run Tests | \`npm test\` |

---

## 📝 Notes

- Watcher monitors: \`.js\`, \`.ts\`, \`.py\`, \`.md\`, \`.json\` files
- Auto-updates every 10 seconds
- Debounces rapid file changes (1s delay)
- Excludes \`node_modules\` and \`.git\` directories

---

*This board is automatically maintained by mission-board-manager/watch.js*
`;
  }

  scanProjectFiles() {
    const stats = { js: 0, ts: 0, py: 0, md: 0, json: 0, total: 0 };
    const rootDir = path.join(__dirname, '..');

    const scanDir = (dir) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            if (item.name !== 'node_modules' && item.name !== '.git') {
              scanDir(fullPath);
            }
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (ext === '.js') stats.js++;
            else if (ext === '.ts') stats.ts++;
            else if (ext === '.py') stats.py++;
            else if (ext === '.md') stats.md++;
            else if (ext === '.json') stats.json++;
            stats.total++;
          }
        }
      } catch (e) {
        // Ignore permission errors
      }
    };

    scanDir(rootDir);
    return stats;
  }

  getRecentActivity() {
    const activities = [];
    const rootDir = path.join(__dirname, '..');

    // Find recently modified files
    const findRecentFiles = (dir, files = []) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            if (item.name !== 'node_modules' && item.name !== '.git') {
              findRecentFiles(fullPath, files);
            }
          } else if (item.isFile()) {
            const stat = fs.statSync(fullPath);
            const age = Date.now() - stat.mtimeMs;
            
            if (age < 3600000) { // Last hour
              files.push({
                path: path.relative(rootDir, fullPath),
                mtime: stat.mtime,
                age: age
              });
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
      
      return files;
    };

    const recentFiles = findRecentFiles(rootDir)
      .sort((a, b) => a.age - b.age)
      .slice(0, 5);

    if (recentFiles.length === 0) {
      return 'No recent activity in the last hour.';
    }

    return recentFiles.map(f => 
      `- \`${f.path}\` - modified ${Math.round(f.age / 60000)} minutes ago`
    ).join('\n');
  }

  getProjectTree() {
    try {
      const rootDir = path.join(__dirname, '..');
      const output = execSync('dir /b', { cwd: rootDir, encoding: 'utf8' });
      return output.trim().split('\n').slice(0, 15).join('\n');
    } catch (e) {
      return 'Unable to generate tree';
    }
  }

  getGitStatus() {
    try {
      const rootDir = path.join(__dirname, '..');
      const status = execSync('git status --short', { cwd: rootDir, encoding: 'utf8' });
      
      if (status.trim() === '') {
        return '✅ Working tree clean';
      }
      
      const lines = status.trim().split('\n').slice(0, 10);
      return '```\n' + lines.join('\n') + '\n```';
    } catch (e) {
      return '⚠️ Not a git repository or git not available';
    }
  }

  handleError(error) {
    console.error('❌ Watcher error:', error);
  }

  stop() {
    console.log('\n🛑 Stopping watcher...');
    
    if (this.watcher) {
      this.watcher.close();
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
    }
    
    this.isRunning = false;
    console.log('✅ Watcher stopped. Goodbye!');
  }
}

// Main execution
const watcher = new MissionBoardWatcher();

// Handle graceful shutdown
process.on('SIGINT', () => {
  watcher.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  watcher.stop();
  process.exit(0);
});

// Start the watcher
watcher.start();

module.exports = MissionBoardWatcher;