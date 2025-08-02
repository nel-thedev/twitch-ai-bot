require('dotenv').config();

const tmi = require('tmi.js');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const prompt = message.slice(4);
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = response.choices[0].message.content.trim().slice(0, 300);
    client.say(channel, `@${tags.username} ${reply}`);
  } catch (err) {
    console.error(err);
    client.say(channel, `@${tags.username} Sorry, there was an error.`);
  }
});
