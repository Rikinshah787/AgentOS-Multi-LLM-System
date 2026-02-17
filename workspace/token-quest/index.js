import inquirer from 'inquirer';
import chalk from 'chalk';

// Game State
let tokens = 5;
let usedActions = [];
let secrets = [
  "🔮 The universe whispers: 'Your next bug fix will work on the first try!'",
  "⭐ Secret revealed: You're better at coding than you think!",
  "🌟 Hidden truth: That feature you're scared to build? You got this!",
  "💫 Cosmic secret: Your code has fewer bugs than you imagine.",
  "🎭 Mystery unlocked: The answer was always in the documentation..."
];

let fortunes = [
  "A semicolon will save your day.",
  "Your code will compile without errors.",
  "A mysterious stranger will star your repo.",
  "The bug you fear is simpler than it seems.",
  "Your next PR will be approved quickly.",
  "A helpful error message is in your future.",
  "Your tests will all pass.",
  "Someone will appreciate your comments."
];

let advices = [
  "Take a break - your brain solves bugs while resting!",
  "Rubber duck debugging never fails.",
  "Read the error message. Really read it.",
  "Git commit often, push fearlessly.",
  "Console.log is your friend, embrace it.",
  "Sleep on it - solutions come in dreams.",
  "Explain it to a non-programmer for clarity.",
  "Delete the code and start fresh sometimes."
];

let jokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
  "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
  "There are only 10 types of people: those who understand binary and those who don't.",
  "Why did the developer go broke? Because he used up all his cache! 💰",
  "I would tell you a UDP joke, but you might not get it.",
  "!false - It's funny because it's true.",
  "A programmer's wife tells him: 'Go to the store and get a loaf of bread. If they have eggs, get a dozen.' He returns with 12 loaves of bread.",
  "Why do Java developers wear glasses? Because they can't C#!"
];

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function displayBanner() {
  console.log('\n' + chalk.cyan.bold('╔══════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║') + chalk.magenta.bold('        🎮 TOKEN QUEST 🎮                  ') + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('║') + chalk.yellow('   Use your 5 magical tokens wisely!       ') + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════╝') + '\n');
}

function displayTokens() {
  const tokenDisplay = '🪙'.repeat(tokens) + '⚫'.repeat(5 - tokens);
  console.log(chalk.bold(`\n  Tokens: ${tokenDisplay} (${tokens} remaining)\n`));
}

async function useToken(action) {
  if (tokens <= 0) {
    console.log(chalk.red('\n  ❌ No tokens left! Game Over!\n'));
    return false;
  }
  
  tokens--;
  usedActions.push(action);
  
  console.log(chalk.green(`\n  ✨ Token used! ${tokens} tokens remaining...\n`));
  
  // Check if game should stop
  if (tokens === 0) {
    console.log(chalk.red.bold('\n  🛑 STOP! All tokens have been used!\n'));
    console.log(chalk.yellow('  Your journey ends here... until you restart! 🔄\n'));
    return false;
  }
  
  return true;
}

async function revealSecret() {
  console.log(chalk.magenta.bold('\n  🔮 REVEALING SECRET...\n'));
  console.log(chalk.magenta(`  ${getRandomItem(secrets)}\n`));
}

async function getFortune() {
  console.log(chalk.yellow.bold('\n  🥠 YOUR FORTUNE...\n'));
  console.log(chalk.yellow(`  ${getRandomItem(fortunes)}\n`));
}

async function getAdvice() {
  console.log(chalk.blue.bold('\n  💡 WISE ADVICE...\n'));
  console.log(chalk.blue(`  ${getRandomItem(advices)}\n`));
}

async function tellJoke() {
  console.log(chalk.green.bold('\n  😂 PROGRAMMING JOKE...\n'));
  console.log(chalk.green(`  ${getRandomItem(jokes)}\n`));
}

async function rollDice() {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const total = dice1 + dice2;
  
  console.log(chalk.cyan.bold('\n  🎲 ROLLING DICE...\n'));
  console.log(chalk.cyan(`  Die 1: ${dice1}  |  Die 2: ${dice2}`));
  console.log(chalk.cyan.bold(`  Total: ${total}\n`));
  
  if (total === 7 || total === 11) {
    console.log(chalk.green.bold('  🎉 LUCKY ROLL! You win bonus wisdom!\n'));
    console.log(chalk.green(`  "${getRandomItem(advices)}"\n`));
  }
}

async function showStats() {
  console.log(chalk.white.bold('\n  📊 YOUR STATS...\n'));
  console.log(chalk.white(`  Tokens Used: ${5 - tokens}/5`));
  console.log(chalk.white(`  Tokens Remaining: ${tokens}`));
  console.log(chalk.white(`  Actions Taken: ${usedActions.join(', ') || 'None yet'}\n`));
}

async function main() {
  displayBanner();
  
  while (tokens > 0) {
    displayTokens();
    
    const choices = [
      { name: '🔮 Reveal Secret', value: 'secret' },
      { name: '🥠 Get Fortune', value: 'fortune' },
      { name: '💡 Get Advice', value: 'advice' },
      { name: '😂 Hear Joke', value: 'joke' },
      { name: '🎲 Roll Dice', value: 'dice' },
      { name: '📊 View Stats', value: 'stats' },
      { name: '🚪 Exit Game', value: 'exit' }
    ];
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: choices
      }
    ]);
    
    if (action === 'exit') {
      console.log(chalk.magenta('\n  👋 Thanks for playing Token Quest!\n'));
      break;
    }
    
    if (action === 'stats') {
      await showStats();
      continue; // Don't use token for stats
    }
    
    let continueGame = true;
    
    switch (action) {
      case 'secret':
        await revealSecret();
        continueGame = await useToken('secret');
        break;
      case 'fortune':
        await getFortune();
        continueGame = await useToken('fortune');
        break;
      case 'advice':
        await getAdvice();
        continueGame = await useToken('advice');
        break;
      case 'joke':
        await tellJoke();
        continueGame = await useToken('joke');
        break;
      case 'dice':
        await rollDice();
        continueGame = await useToken('dice');
        break;
    }
    
    if (!continueGame) {
      break;
    }
  }
  
  // Final summary
  console.log(chalk.cyan.bold('\n═══════════════════════════════════════════'));
  console.log(chalk.cyan.bold('           🎮 GAME SUMMARY 🎮'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════'));
  console.log(chalk.white(`\n  Total Actions: ${usedActions.length}`));
  console.log(chalk.white(`  Actions Used: ${usedActions.join(', ') || 'None'}\n`));
  console.log(chalk.magenta('  Thanks for playing! Run again for more fun! 🔄\n'));
}

main().catch(console.error);