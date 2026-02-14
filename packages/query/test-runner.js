#!/usr/bin/env node

import { spawn } from 'child_process';

// 直接使用 npx 运行 vitest
function runTests() {
  console.log('Running tests with npx vitest...');
  
  // 使用 npx 运行 vitest
  const vitest = spawn('npx', ['vitest', ...process.argv.slice(2)], { 
    stdio: 'inherit',
    shell: true 
  });
  
  vitest.on('error', (error) => {
    console.error('Error: Failed to start vitest. Make sure dependencies are installed.');
    console.error('Please run "pnpm install" in the repository root.');
    process.exit(1);
  });
  
  vitest.on('exit', (code) => {
    process.exit(code);
  });
}

runTests();