require('dotenv').config();
const tmi = require('tmi.js');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ADMINS = (process.env.ADMINS || '').split(',').map(s => s.trim().toLowerCase());

const globalCooldown = 15 * 1000;
const userCooldown = 30 * 1000;

let lastGlobalUse = 0;
const userCooldowns = {};

function truncateAtWord(text, maxLength = 300) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).split(' ').slice(0, -1).join(' ') + '…';
}

const client = new tmi.Client({
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH,
  },
  channels: [process.env.CHANNEL],
});

client.connect();

client.on('message', async (channel, tags, message, self) => {
  if (self || !message.startsWith('!ai ')) return;

  const now = Date.now();
  const user = tags.username.toLowerCase();
  const isAdmin = ADMINS.includes(user);

  const prompt = message.slice(4).trim();
  if (!prompt) {
    client.say(channel, `@${user} please provide a prompt after !ai`);
    return;
  }

  // Global cooldown
  if (!isAdmin && now - lastGlobalUse < globalCooldown) {
    const remaining = Math.ceil((lastGlobalUse + globalCooldown - now) / 1000);
    client.say(channel, `@${user} please wait ${remaining}s. AI is cooling down globally.`);
    return;
  }

  // Per-user cooldown
  if (!isAdmin && userCooldowns[user] && now - userCooldowns[user] < userCooldown) {
    const remaining = Math.ceil((userCooldowns[user] + userCooldown - now) / 1000);
    client.say(channel, `@${user} you're still on cooldown for ${remaining}s.`);
    return;
  }

  // Passed cooldowns
  if (!isAdmin) {
    lastGlobalUse = now;
    userCooldowns[user] = now;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [{ role: 'user', content: `You are Nelzbot. You are a friendly bot that replies to twitch chatters. Your personality is: positively aggresive, witty, not cringe, not a nerd, casual, memey, based, sassy, slightly erratic. You reply in under 300 characters: ${prompt}` }],
      max_tokens: 100,
    });

    const raw = response.choices[0].message.content.trim();
    const reply = truncateAtWord(raw, 300);
    client.say(channel, `@${user} ${reply}`);
  } catch (err) {
    console.error(err);
    client.say(channel, `@${user} Sorry, there was an error.`);
  }
});

setInterval(() => {
  const now = Date.now();
  for (const user in userCooldowns) {
    if (now - userCooldowns[user] > 10 * userCooldown) {
      delete userCooldowns[user];
    }
  }
}, 2 * 60 * 1000);
