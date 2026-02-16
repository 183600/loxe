#!/bin/bash
# 确保依赖已安装的测试脚本
echo "Installing dependencies..."
pnpm install

echo "Running tests..."
npx vitest