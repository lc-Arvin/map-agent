/**
 * 环境变量加载工具
 * 自动从.env文件加载环境变量
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * 加载.env文件
 * 按优先级查找：
 * 1. 当前工作目录下的.env
 * 2. 项目根目录下的.env
 * 3. 不报错（如果没找到）
 */
export function loadEnv(): void {
  const cwd = process.cwd();
  const envPaths: string[] = [];

  // 1. 当前工作目录
  const cwdEnv = resolve(cwd, '.env');
  if (existsSync(cwdEnv)) {
    envPaths.push(cwdEnv);
  }

  // 2. 项目根目录（如果与cwd不同）
  // 尝试找到package.json所在的目录
  let currentDir = cwd;
  for (let i = 0; i < 5; i++) { // 向上查找5层
    const pkgPath = resolve(currentDir, 'package.json');
    if (existsSync(pkgPath)) {
      const rootEnv = resolve(currentDir, '.env');
      if (rootEnv !== cwdEnv && existsSync(rootEnv)) {
        envPaths.push(rootEnv);
      }
      break;
    }
    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  // 3. 显式指定的路径（如果存在）
  if (process.env.DOTENV_CONFIG_PATH && existsSync(process.env.DOTENV_CONFIG_PATH)) {
    envPaths.push(process.env.DOTENV_CONFIG_PATH);
  }

  // 加载所有找到的.env文件（后面的覆盖前面的）
  for (const path of envPaths) {
    const result = config({ path });
    if (result.parsed) {
      console.log(`✅ Loaded env from: ${path}`);
    }
  }

  // 如果没有找到任何.env文件，给出提示
  if (envPaths.length === 0) {
    console.log('⚠️  No .env file found. Using environment variables from system.');
  }
}

/**
 * 获取必需的环境变量
 * 如果不存在则抛出错误
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Environment variable ${name} is required.\n` +
      `Please set it in your .env file or environment.\n` +
      `Example: echo "${name}=your_value" > .env`
    );
  }
  return value;
}

/**
 * 获取可选的环境变量
 */
export function getEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}
