#!/usr/bin/env node

// 检查 vitest 是否可用
try {
  require('vitest');
  console.log('vitest found, running tests...');
  
  // 如果 vitest 可用，则运行它
  const { spawn } = require('child_process');
  const vitest = spawn('npx', ['vitest', ...process.argv.slice(2)], { 
    stdio: 'inherit',
    shell: true 
  });
  
  vitest.on('exit', (code) => {
    process.exit(code);
  });
  
} catch (error) {
  console.error('Error: vitest is not installed. Please run "pnpm install" in the repository root.');
  console.error('This is a known issue when dependencies are not installed.');
  process.exit(1);
}