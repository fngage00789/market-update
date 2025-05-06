const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const express = require('express');
const fs = require('fs');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Configuration
const CONFIG = {
  UPDATE_INTERVAL: 15 * 60 * 1000, // 15 minutes (in milliseconds)
  PREFIX: '!',
  SYMBOLS: {
    // Forex pairs
    EURUSD: 'EURUSD=X',
    GBPUSD: 'GBPUSD=X',
    USDJPY: 'JPY=X',
    USDCHF: 'CHF=X',
    AUDUSD: 'AUDUSD=X',
    USDCAD: 'CAD=X',
    NZDUSD: 'NZDUSD=X',
    
    // Gold and related
    GOLD: 'GC=F',      // Gold Futures
    GLD: 'GLD',        // SPDR Gold Trust ETF
    IAU: 'IAU',        // iShares Gold Trust
    
    // NASDAQ
    NAS100: '^NDX'     // NASDAQ-100 Index
  }
};

// Server-Channel Mapping (Prevents duplicates across servers)
const serverChannels = new Map(); // Format: { serverId: channelId }

// Market Data Cache
let marketData = {
  lastUpdated: null,
  prices: {}
};

let updateInterval; // Stores the auto-update interval

// Logging Setup
if (!fs.existsSync('bot.log')) fs.writeFileSync('bot.log', '');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync('bot.log', logMessage);
}

// Keep-alive server
const app = express();
app.get('/', (req, res) => res.send('Market Bot is running!'));
app.listen(3000, () => log('Keep-alive server started on port 3000'));

// ======================
// MARKET DATA FUNCTIONS
// ======================

/**
 * Fetches detailed market data from Yahoo Finance API
 */
async function fetchMarketData(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=1d`;
    const response = await axios.get(url);
    const data = response.data.chart.result[0];
    const meta = data.meta;
    const quote = data.indicators.quote[0];
    
    const dayLow = Math.min(...quote.low.filter(Boolean));
    const dayHigh = Math.max(...quote.high.filter(Boolean));
    
    return {
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      dayLow,
      dayHigh,
      volume: meta.regularMarketVolume || 0
    };
  } catch (error) {
    log(`Failed to fetch ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Updates all market data at once
 */
async function updateAllMarketData() {
  log('Fetching latest market data...');
  
  const updates = Object.entries(CONFIG.SYMBOLS).map(async ([key, symbol]) => {
    const data = await fetchMarketData(symbol);
    if (data) marketData.prices[key] = data;
  });

  await Promise.all(updates);
  marketData.lastUpdated = new Date();
  log(`Market data updated at ${marketData.lastUpdated.toISOString()}`);
}

// ======================
// DISCORD EMBED BUILDERS
// ======================

function createForexEmbed() {
  const timestamp = marketData.lastUpdated.toLocaleString();
  const embed = new EmbedBuilder()
    .setTitle('💱 Forex Markets Update')
    .setDescription(`Current rates as of ${timestamp} UTC`)
    .setColor(0x3498db);

  const pairs = [
    { key: 'EURUSD', name: 'EUR/USD' },
    { key: 'GBPUSD', name: 'GBP/USD' },
    { key: 'USDJPY', name: 'USD/JPY' },
    { key: 'USDCHF', name: 'USD/CHF' },
    { key: 'AUDUSD', name: 'AUD/USD' },
    { key: 'USDCAD', name: 'USD/CAD' },
    { key: 'NZDUSD', name: 'NZD/USD' }
  ];

  pairs.forEach(pair => {
    const data = marketData.prices[pair.key];
    if (data) {
      embed.addFields({
        name: pair.name,
        value: `📊 **Rate:** ${data.price.toFixed(5)}\n` +
               `📈 **Change:** ${data.change >= 0 ? '▲' : '▼'} ${Math.abs(data.changePercent).toFixed(2)}%\n` +
               `🔽 **Low:** ${data.dayLow.toFixed(5)}\n` +
               `🔼 **High:** ${data.dayHigh.toFixed(5)}\n` +
               `⏮ **Prev Close:** ${data.previousClose.toFixed(5)}`,
        inline: true
      });
    }
  });

  embed.setFooter({ text: 'Data provided by Yahoo Finance • Updates every 15 minutes' });
  return embed;
}

function createCommoditiesEmbed() {
  const timestamp = marketData.lastUpdated.toLocaleString();
  const embed = new EmbedBuilder()
    .setTitle('💰 Commodities Update')
    .setDescription(`Gold prices as of ${timestamp} UTC`)
    .setColor(0xffd700);

  // Gold Futures
  const gold = marketData.prices.GOLD;
  if (gold) {
    embed.addFields({
      name: 'Gold Futures (GC=F)',
      value: `💰 **Price:** $${gold.price.toFixed(2)}\n` +
             `📈 **Change:** ${gold.change >= 0 ? '▲' : '▼'} ${Math.abs(gold.changePercent).toFixed(2)}%\n` +
             `📊 **Volume:** ${gold.volume.toLocaleString()}\n` +
             `🔄 **Range:** $${gold.dayLow.toFixed(2)} - $${gold.dayHigh.toFixed(2)}`
    });
  }

  return embed;
}

function createNasdaqEmbed() {
  const nas100 = marketData.prices.NAS100;
  if (!nas100) return null;

  const timestamp = marketData.lastUpdated.toLocaleString();
  const embed = new EmbedBuilder()
    .setTitle('📈 NASDAQ-100 Index')
    .setDescription(`Current index values as of ${timestamp} UTC`)
    .setColor(0x9b59b6)
    .addFields(
      {
        name: 'NASDAQ-100 (^NDX)',
        value: `📊 **Price:** ${nas100.price.toFixed(2)}\n` +
               `📈 **Change:** ${nas100.change >= 0 ? '▲' : '▼'} ${Math.abs(nas100.changePercent).toFixed(2)}%\n` +
               `🔄 **Range:** ${nas100.dayLow.toFixed(2)} - ${nas100.dayHigh.toFixed(2)}\n` +
               `📦 **Volume:** ${nas100.volume.toLocaleString()}`
      }
    )
    .setFooter({ text: 'Data provided by Yahoo Finance' });

  return embed;
}

// ======================
// DISCORD MESSAGE HANDLING
// ======================

/**
 * Sends market updates to a specific server's channel
 */
async function sendServerUpdate(serverId) {
  const channelId = serverChannels.get(serverId);
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      serverChannels.delete(serverId); // Remove invalid channel
      return;
    }

    // Clear previous bot messages
    const messages = await channel.messages.fetch({ limit: 5 });
    const botMessages = messages.filter(m => m.author.id === client.user.id);
    if (botMessages.size > 0) await channel.bulkDelete(botMessages);

    // Send new embeds
    await channel.send({ embeds: [createForexEmbed()] });
    await channel.send({ embeds: [createCommoditiesEmbed()] });
    
    const nasdaqEmbed = createNasdaqEmbed();
    if (nasdaqEmbed) await channel.send({ embeds: [nasdaqEmbed] });

  } catch (error) {
    log(`Error updating server ${serverId}: ${error.message}`);
  }
}

/**
 * Starts the auto-update cycle for all servers
 */
function startAutoUpdates() {
  if (updateInterval) clearInterval(updateInterval);

  updateInterval = setInterval(async () => {
    try {
      await updateAllMarketData();
      // Send updates to all registered servers
      for (const [serverId] of serverChannels) {
        await sendServerUpdate(serverId);
      }
    } catch (error) {
      log(`Auto-update failed: ${error.message}`);
    }
  }, CONFIG.UPDATE_INTERVAL);

  log(`Started 15-minute auto-update cycle`);
}

// ======================
// DISCORD EVENT HANDLERS
// ======================

client.on('ready', async () => {
  log(`Logged in as ${client.user.tag} (${client.user.id})`);
  await updateAllMarketData();
  startAutoUpdates();
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(CONFIG.PREFIX)) return;

  const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    // Set up update channel for this server
    if (command === 'setup_channel') {
      if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.reply('🔒 You need administrator permissions to set up updates!');
      }

      serverChannels.set(message.guild.id, message.channelId);
      await message.reply('✅ This channel will now receive automatic market updates every 15 minutes!');
      
      // Send first update immediately
      await updateAllMarketData();
      await sendServerUpdate(message.guild.id);
    }

    // Manual market update
    else if (command === 'market_update') {
      await updateAllMarketData();
      await message.reply({ embeds: [createForexEmbed()] });
      await message.channel.send({ embeds: [createCommoditiesEmbed()] });
      
      const nasdaqEmbed = createNasdaqEmbed();
      if (nasdaqEmbed) await message.channel.send({ embeds: [nasdaqEmbed] });
    }

    // Change update interval (admin only)
    else if (command === 'set_interval') {
      if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.reply('🔒 Administrator permissions required!');
      }

      const minutes = parseInt(args[0]);
      if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
        return message.reply('❌ Please specify minutes between 1-1440 (24 hours)');
      }

      CONFIG.UPDATE_INTERVAL = minutes * 60 * 1000;
      startAutoUpdates();
      await message.reply(`🔄 Update interval changed to ${minutes} minutes`);
    }

    // View logs (admin only)
    else if (command === 'logs') {
      if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.reply('🔒 Administrator permissions required!');
      }

      try {
        const logData = fs.readFileSync('bot.log', 'utf8');
        await message.reply({
          files: [{
            attachment: Buffer.from(logData),
            name: 'market_bot_logs.txt'
          }]
        });
      } catch (error) {
        await message.reply('❌ Failed to read logs');
      }
    }
  } catch (error) {
    log(`Command error: ${error.message}`);
    await message.reply('❌ An error occurred processing your command');
  }
});

// Error handling
process.on('unhandledRejection', error => {
  log(`Unhandled rejection: ${error.message}`);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN).catch(error => {
  log(`Login failed: ${error.message}`);
  process.exit(1);
});