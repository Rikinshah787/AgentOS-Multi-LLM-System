#!/usr/bin/env node
const readline = require("readline");
const calculator = require("./index");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("JS Calculator (Node.js)");
console.log("Commands: add, subtract, multiply, divide, exit");

function prompt() {
  rl.question("> ", (input) => {
    const [command, a, b] = input.trim().split(" ");
    const numA = parseFloat(a);
    const numB = parseFloat(b);

    if (command === "exit") {
      rl.close();
      return;
    }

    try {
      let result;
      switch (command) {
        case "add":
          result = calculator.add(numA, numB);
          break;
        case "subtract":
          result = calculator.subtract(numA, numB);
          break;
        case "multiply":
          result = calculator.multiply(numA, numB);
          break;
        case "divide":
          result = calculator.divide(numA, numB);
          break;
        default:
          console.log("Invalid command");
          prompt();
          return;
      }
      console.log(`Result: ${result}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
    prompt();
  });
}

prompt();