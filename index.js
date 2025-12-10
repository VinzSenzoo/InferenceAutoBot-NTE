import axios from 'axios';
import cfonts from 'cfonts';
import gradient from 'gradient-string';
import chalk from 'chalk';
import fs from 'fs/promises';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import ora from 'ora';

const logger = {
  info: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || 'ℹ️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.green('INFO');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  warn: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '⚠️ ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.yellow('WARN');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  error: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '❌ ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.red('ERROR');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  debug: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '🔍  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.blue('DEBUG');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  }
};

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function centerText(text, width) {
  const cleanText = stripAnsi(text);
  const textLength = cleanText.length;
  const totalPadding = Math.max(0, width - textLength);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}`;
}

function printHeader(title) {
  const width = 80;
  console.log(gradient.morning(`┬${'─'.repeat(width - 2)}┬`));
  console.log(gradient.morning(`│ ${title.padEnd(width - 4)} │`));
  console.log(gradient.morning(`┴${'─'.repeat(width - 2)}┴`));
}

function printInfo(label, value, context) {
  logger.info(`${label.padEnd(15)}: ${chalk.cyan(value)}`, { emoji: '📍 ', context });
}

function printProfileInfo(userId, email, points, context) {
  printHeader(`Profile Info ${context}`);
  printInfo('User ID', userId || 'N/A', context);
  printInfo('Email', email || 'N/A', context);
  printInfo('Total Points', points.toString(), context);
  console.log('\n');
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/102.0'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getAxiosConfig(proxy, token, additionalHeaders = {}) {
  const headers = {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9,id;q=0.8',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    'origin': 'https://truthtensor.com',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://truthtensor.com/',
    'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': getRandomUserAgent(),
    'authorization': `Bearer ${token}`,
    ...additionalHeaders
  };
  const config = {
    headers,
    timeout: 60000
  };
  if (proxy) {
    config.httpsAgent = newAgent(proxy);
    config.proxy = false;
  }
  return config;
}

function newAgent(proxy) {
  if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
    return new HttpsProxyAgent(proxy);
  } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return new SocksProxyAgent(proxy);
  } else {
    logger.warn(`Unsupported proxy: ${proxy}`);
    return null;
  }
}

async function requestWithRetry(method, url, payload = null, config = {}, retries = 3, backoff = 2000, context) {
  for (let i = 0; i < retries; i++) {
    try {
      let response;
      if (method.toLowerCase() === 'get') {
        response = await axios.get(url, config);
      } else if (method.toLowerCase() === 'post') {
        response = await axios.post(url, payload, config);
      } else if (method.toLowerCase() === 'patch') {
        response = await axios.patch(url, payload, config);
      } else if (method.toLowerCase() === 'put') {
        response = await axios.put(url, payload, config);
      } else {
        throw new Error(`Method ${method} not supported`);
      }
      return response;
    } catch (error) {
      let errorMsg = error.message;
      if (error.response) {
        errorMsg += ` | Status: ${error.response.status} | Body: ${JSON.stringify(error.response.data || 'No body')}`;
      }
      logger.error(`Request failed: ${errorMsg}`, { context });

      if (error.response && error.response.status >= 500 && i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries}) due to server error`, { emoji: '🔄', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      if (i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries})`, { emoji: '🔄', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      throw error;
    }
  }
}

async function readTokens() {
  try {
    const data = await fs.readFile('token.txt', 'utf-8');
    const tokens = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const accounts = tokens.map(token => ({ token }));
    if (accounts.length === 0) {
      throw new Error('No tokens found in token.txt');
    }
    logger.info(`Loaded ${accounts.length} account${accounts.length === 1 ? '' : 's'}`, { emoji: '🔑 ' });
    return accounts;
  } catch (error) {
    logger.error(`Failed to read token.txt: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function readProxies() {
  try {
    const data = await fs.readFile('proxy.txt', 'utf-8');
    const proxies = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (proxies.length === 0) {
      logger.warn('No proxies found. Proceeding without proxy.', { emoji: '⚠️ ' });
    } else {
      logger.info(`Loaded ${proxies.length} prox${proxies.length === 1 ? 'y' : 'ies'}`, { emoji: '🌐 ' });
    }
    return proxies;
  } catch (error) {
    logger.warn('proxy.txt not found.', { emoji: '⚠️ ' });
    return [];
  }
}

async function getPublicIP(proxy, context) {
  try {
    const config = getAxiosConfig(proxy, null, {});
    const response = await requestWithRetry('get', 'https://api.ipify.org?format=json', null, config, 3, 2000, context);
    return response.data.ip || 'Unknown';
  } catch (error) {
    logger.error(`Failed to get IP: ${error.message}`, { emoji: '❌ ', context });
    return 'Error retrieving IP';
  }
}

async function getEmail(token, proxy, context) {
  const url = 'https://api.truthtensor.com/users/me/connected-accounts';
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: 'Fetching email...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    const accounts = response.data.accounts;
    if (accounts && accounts.length > 0) {
      return accounts[0].email || 'N/A';
    }
    return 'N/A';
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch email: ${error.message}`));
    return 'N/A';
  }
}

async function getPopularMarkets(token, proxy, context) {
  const url = 'https://seeker.truthtensor.com/markets/popular?limit=50';
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: 'Fetching popular markets...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    return response.data;
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch popular markets: ${error.message}`));
    return [];
  }
}

async function performReact(decisionId, reaction, agentName, token, proxy, context) {
  const url = 'https://api.truthtensor.com/reactions/add';
  const payload = { decision_id: decisionId, reaction };
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: `Reacting with ${reaction} to agent ${agentName}...`, spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, context);
    spinner.succeed(chalk.bold.greenBright(` Reacted successfully with ${reaction} to agent ${agentName}!`));
    return response.data.reaction;
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to react to agent ${agentName}: ${error.message}`));
    return null;
  }
}

async function getStrategies(token, proxy, context) {
  const url = 'https://seeker.truthtensor.com/strategies?includeInactive=true';
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: 'Fetching strategies...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    return response.data;
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch strategies: ${error.message}`));
    return [];
  }
}

async function updateStrategy(strategyId, newConfig, token, proxy, context) {
  const url = `https://seeker.truthtensor.com/strategies/${strategyId}`;
  const payload = { config: newConfig };
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: `Updating strategy ${strategyId}...`, spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('put', url, payload, config, 3, 2000, context);
    spinner.succeed(chalk.bold.greenBright(` Updated strategy successfully! New model: ${response.data.config.model}`));
    return response.data;
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to update strategy: ${error.message}`));
    return null;
  }
}

async function getPoints(userId, token, proxy, context) {
  const url = `https://api.truthtensor.com/points/${userId}`;
  const config = getAxiosConfig(proxy, token);
  const spinner = ora({ text: 'Fetching points...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    return response.data.points;
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch points: ${error.message}`));
    return 0;
  }
}

const models = [
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro" },
  { id: "qwen/qwen3-max", name: "Qwen3 Max" },
  { id: "openai/gpt-5.1", name: "GPT-5.1" },
  { id: "x-ai/grok-4", name: "Grok 4" },
  { id: "deepseek/deepseek-chat-v3.1", name: "DeepSeek Chat 3.1" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "moonshotai/kimi-k2-thinking", name: "Kimi K2 Thinking" },
  { id: "minimax/minimax-m2", name: "MiniMax M2" }
];

async function processAccount(account, index, total, proxy) {
  const context = `Account ${index + 1}/${total}`;
  logger.info(chalk.bold.magentaBright(`Starting account processing`), { emoji: '🚀 ', context });

  const { token } = account;

  printHeader(`Account Info ${context}`);
  const ip = await getPublicIP(proxy, context);
  printInfo('IP', ip, context);
  const email = await getEmail(token, proxy, context);
  printInfo('Email', email, context);
  console.log('\n');

  try {
    logger.info('Starting Daily React Process...', { emoji: '🛎️ ', context });
    const markets = await getPopularMarkets(token, proxy, context);
    let allDecisions = [];
    markets.forEach(market => {
      allDecisions = allDecisions.concat(market.recentDecisions || []);
    });

    if (allDecisions.length === 0) {
      logger.warn('No recent decisions found.', { emoji: '⚠️ ', context });
    } else {
      const reactions = ['flag', 'poop', 'joy', 'rocket'];
      const selectedDecisions = [];
      for (let i = 0; i < 5; i++) {
        if (allDecisions.length > 0) {
          const randomIndex = Math.floor(Math.random() * allDecisions.length);
          selectedDecisions.push(allDecisions.splice(randomIndex, 1)[0]);
        }
      }

      let userId = null;
      for (const decision of selectedDecisions) {
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        const agentName = decision.agent.name || 'Unknown';
        const reactResult = await performReact(decision.id, randomReaction, agentName, token, proxy, context);
        if (reactResult && reactResult.user_id && !userId) {
          userId = reactResult.user_id;
        }
        await delay(5);
      }

      console.log('\n');
      logger.info('Starting Daily Update Agent Process...', { emoji: '📋 ', context });
      const strategies = await getStrategies(token, proxy, context);
      if (strategies.length === 0) {
        logger.warn('No strategies found.', { emoji: '⚠️ ', context });
      } else {
        const randomStrategyIndex = Math.floor(Math.random() * strategies.length);
        const strategy = strategies[randomStrategyIndex];
        logger.info(`Selected strategy: ${strategy.name} [ Current model: ${strategy.config.model} ]`, { emoji: '📍 ', context });

        const currentModelId = strategy.config.model;
        const availableModels = models.filter(m => m.id !== currentModelId);
        if (availableModels.length > 0) {
          const newModel = availableModels[Math.floor(Math.random() * availableModels.length)];
          const newConfig = { ...strategy.config, model: newModel.id };
          await updateStrategy(strategy.id, newConfig, token, proxy, context);
        } else {
          logger.warn('No alternative models available.', { emoji: '⚠️ ', context });
        }
      }
      
      console.log('\n');
      
      if (userId) {
        const points = await getPoints(userId, token, proxy, context);
        printProfileInfo(userId, email, points, context);
      } else {
        logger.warn('No user ID found from reactions.', { emoji: '⚠️ ', context });
      }

      logger.info(chalk.bold.greenBright(`Completed account processing`), { emoji: '🎉 ', context });
      console.log(chalk.cyanBright('________________________________________________________________________________'));
    }
  } catch (error) {
    logger.error(`Error processing account: ${error.message}`, { emoji: '❌ ', context });
  }
}

let globalUseProxy = false;
let globalProxies = [];

async function initializeConfig() {
  const useProxyAns = await askQuestion(chalk.cyanBright('🔌 Do You Want to Use Proxy? (y/n): '));
  if (useProxyAns.trim().toLowerCase() === 'y') {
    globalUseProxy = true;
    globalProxies = await readProxies();
    if (globalProxies.length === 0) {
      globalUseProxy = false;
      logger.warn('No proxies available, proceeding without proxy.', { emoji: '⚠️ ' });
    }
  } else {
    logger.info('Proceeding without proxy.', { emoji: 'ℹ️ ' });
  }
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function runCycle() {
  const accounts = await readTokens();
  if (accounts.length === 0) {
    logger.error('No accounts found in token.txt. Exiting cycle.', { emoji: '❌ ' });
    return;
  }

  for (let i = 0; i < accounts.length; i++) {
    const proxy = globalUseProxy ? globalProxies[i % globalProxies.length] : null;
    try {
      await processAccount(accounts[i], i, accounts.length, proxy);
    } catch (error) {
      logger.error(`Error processing account: ${error.message}`, { emoji: '❌ ', context: `Account ${i + 1}/${accounts.length}` });
    }
    if (i < accounts.length - 1) {
      console.log('\n\n');
    }
    await delay(5);
  }
}

async function run() {
  const terminalWidth = process.stdout.columns || 80;
  cfonts.say('NT EXHAUST', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true
  });
  console.log(gradient.retro(centerText('=== Telegram Channel 🚀 : NT Exhaust (@NTExhaust) ===', terminalWidth)));
  console.log(gradient.retro(centerText('✪ BOT INFERENCE AUTO DAILY REACT & UPDATE AGENT ✪', terminalWidth)));
  console.log('\n');
  await initializeConfig();

  while (true) {
    await runCycle();
    console.log();
    logger.info(chalk.bold.yellowBright('Cycle completed. Waiting 24 hours...'), { emoji: '🔄 ' });
    await delay(86400);
  }
}

run().catch(error => logger.error(`Fatal error: ${error.message}`, { emoji: '❌' }));