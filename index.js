const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const express = require("express");
const fs = require("fs");

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Configuration
const CONFIG = {
  UPDATE_INTERVAL: 15 * 60 * 1000, // 15 minutes
  PREFIX: "!",
  SYMBOLS: {
    // Forex pairs
    EURUSD: "EURUSD=X",
    GBPUSD: "GBPUSD=X",
    USDJPY: "JPY=X",
    USDCHF: "CHF=X",
    AUDUSD: "AUDUSD=X",
    USDCAD: "CAD=X",
    NZDUSD: "NZDUSD=X",

    // Gold and related
    GOLD: "GC=F",
    GLD: "GLD", // SPDR Gold Trust ETF
    IAU: "IAU", // iShares Gold Trust

    // NASDAQ
    NAS100: "^NDX",
  },
};

// Global variables
let targetChannelId = null;
let marketData = {
  lastUpdated: null,
  prices: {},
};
let updateInterval;

// Create log file if it doesn't exist
if (!fs.existsSync("bot.log")) {
  fs.writeFileSync("bot.log", "");
}

/**
 * Log messages to console and file
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync("bot.log", logMessage);
}

// Create HTTP server to keep bot alive
const app = express();
app.get("/", (req, res) => res.send("Market Bot is running!"));
app.listen(3000, () => log("Keep-alive server running on port 3000"));

/**
 * Fetch detailed market data from Yahoo Finance
 */
async function fetchDetailedMarketData(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=1d`;
    const response = await axios.get(url);
    const data = response.data.chart.result[0];
    const meta = data.meta;
    const indicators = data.indicators.quote[0];

    // Calculate day range
    const dayLow = Math.min(...indicators.low.filter(Boolean));
    const dayHigh = Math.max(...indicators.high.filter(Boolean));

    return {
      symbol: symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePercent:
        ((meta.regularMarketPrice - meta.chartPreviousClose) /
          meta.chartPreviousClose) *
        100,
      dayLow,
      dayHigh,
      volume: meta.regularMarketVolume || 0,
      currency: meta.currency || "USD",
    };
  } catch (error) {
    log(`Error fetching detailed data for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Update all market data
 */
async function updateAllMarketData() {
  log("Updating market data...");
  const updatePromises = Object.entries(CONFIG.SYMBOLS).map(
    async ([key, symbol]) => {
      const data = await fetchDetailedMarketData(symbol);
      if (data) {
        marketData.prices[key] = data;
      }
    },
  );

  await Promise.all(updatePromises);
  marketData.lastUpdated = new Date();
  log(`Market data updated at ${marketData.lastUpdated}`);
}

/**
 * Create detailed forex embed
 */
function createForexEmbed() {
  const timestamp =
    marketData.lastUpdated.toISOString().replace("T", " ").replace(/\..+/, "") +
    " UTC";

  const embed = new EmbedBuilder()
    .setTitle("💱 Forex Markets Update")
    .setDescription(`Current forex rates as of ${timestamp}`)
    .setColor(0x3498db);

  const forexPairs = [
    { key: "EURUSD", name: "EUR/USD" },
    { key: "GBPUSD", name: "GBP/USD" },
    { key: "USDJPY", name: "USD/JPY" },
    { key: "USDCHF", name: "USD/CHF" },
    { key: "AUDUSD", name: "AUD/USD" },
    { key: "USDCAD", name: "USD/CAD" },
    { key: "NZDUSD", name: "NZD/USD" },
  ];

  forexPairs.forEach((pair) => {
    const data = marketData.prices[pair.key];
    if (data) {
      embed.addFields({
        name: `${pair.name}`,
        value:
          `**Current Rate:** ${data.price.toFixed(data.key === "USDJPY" ? 2 : 5)}\n` +
          `**Change:** ${data.change >= 0 ? "+" : ""}${data.changePercent.toFixed(2)}%\n` +
          `**Day Range:** ${data.dayLow.toFixed(data.key === "USDJPY" ? 2 : 5)} - ${data.dayHigh.toFixed(data.key === "USDJPY" ? 2 : 5)}\n` +
          `**Previous Close:** ${data.previousClose.toFixed(data.key === "USDJPY" ? 2 : 5)}`,
        inline: true,
      });
    }
  });

  embed.setFooter({
    text: "Forex data provided by Yahoo Finance • Auto-update every 15 minutes",
  });
  return embed;
}

/**
 * Create detailed gold embed
 */
function createGoldEmbed() {
  const timestamp =
    marketData.lastUpdated.toISOString().replace("T", " ").replace(/\..+/, "") +
    " UTC";

  const embed = new EmbedBuilder()
    .setTitle("💰 Gold Markets Update")
    .setDescription(`Current gold prices as of ${timestamp}`)
    .setColor(0xffd700);

  // Gold futures
  const gold = marketData.prices.GOLD;
  if (gold) {
    embed.addFields({
      name: "Gold Futures / US Dollar",
      value:
        `**Current Price:** $${gold.price.toFixed(2)}\n` +
        `**Change:** ${gold.change >= 0 ? "+" : ""}${gold.changePercent.toFixed(2)}%\n` +
        `**Day Range:** $${gold.dayLow.toFixed(2)} - $${gold.dayHigh.toFixed(2)}\n` +
        `**Volume:** ${gold.volume.toLocaleString()}\n` +
        `**Previous Close:** $${gold.previousClose.toFixed(2)}`,
    });
  }

  // Gold ETFs
  const gld = marketData.prices.GLD;
  const iau = marketData.prices.IAU;

  if (gld) {
    embed.addFields({
      name: "SPDR Gold Trust ETF",
      value:
        `**Current Price:** $${gld.price.toFixed(2)}\n` +
        `**Change:** ${gld.change >= 0 ? "+" : ""}${gld.changePercent.toFixed(2)}%\n` +
        `**Day Range:** $${gld.dayLow.toFixed(2)} - $${gld.dayHigh.toFixed(2)}\n` +
        `**Volume:** ${gld.volume.toLocaleString()}\n` +
        `**Previous Close:** $${gld.previousClose.toFixed(2)}`,
      inline: true,
    });
  }

  if (iau) {
    embed.addFields({
      name: "iShares Gold Trust",
      value:
        `**Current Price:** $${iau.price.toFixed(2)}\n` +
        `**Change:** ${iau.change >= 0 ? "+" : ""}${iau.changePercent.toFixed(2)}%\n` +
        `**Day Range:** $${iau.dayLow.toFixed(2)} - $${iau.dayHigh.toFixed(2)}\n` +
        `**Volume:** ${iau.volume.toLocaleString()}\n` +
        `**Previous Close:** $${iau.previousClose.toFixed(2)}`,
      inline: true,
    });
  }

  embed.setFooter({
    text: "Gold data provided by Yahoo Finance • Auto-update every 15 minutes",
  });
  return embed;
}

/**
 * Create detailed NASDAQ embed
 */
function createNasdaqEmbed() {
  const timestamp =
    marketData.lastUpdated.toISOString().replace("T", " ").replace(/\..+/, "") +
    " UTC";
  const nas100 = marketData.prices.NAS100;

  if (!nas100) return null;

  const embed = new EmbedBuilder()
    .setTitle("📈 NASDAQ-100 Update")
    .setDescription(`Current index value as of ${timestamp}`)
    .setColor(0x9b59b6)
    .addFields({
      name: "NASDAQ-100",
      value:
        `**Current Value:** ${nas100.price.toFixed(2)}\n` +
        `**Change:** ${nas100.change >= 0 ? "+" : ""}${nas100.changePercent.toFixed(2)}%\n` +
        `**Day Range:** ${nas100.dayLow.toFixed(2)} - ${nas100.dayHigh.toFixed(2)}\n` +
        `**Volume:** ${nas100.volume.toLocaleString()}\n` +
        `**Previous Close:** ${nas100.previousClose.toFixed(2)}\n` +
        `**52 Week Range:** 16,542.20 - 22,222.61`,
    })
    .setFooter({
      text: "NASDAQ-100 data provided by Yahoo Finance • Auto-update every 15 minutes",
    });

  return embed;
}

/**
 * Send market updates to the configured channel
 */
async function sendMarketUpdate() {
  if (!targetChannelId) {
    log("No target channel set - skipping update");
    return;
  }

  try {
    const channel = await client.channels.fetch(targetChannelId);
    if (!channel) {
      log("Channel not found");
      return;
    }

    // Get previous bot messages
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter((m) => m.author.id === client.user.id);

    // Delete previous bot messages
    if (botMessages.size > 0) {
      await channel.bulkDelete(botMessages);
    }

    // Send new market data as separate embeds
    const forexEmbed = createForexEmbed();
    const goldEmbed = createGoldEmbed();
    const nasdaqEmbed = createNasdaqEmbed();

    await channel.send({ embeds: [forexEmbed] });
    await channel.send({ embeds: [goldEmbed] });
    if (nasdaqEmbed) {
      await channel.send({ embeds: [nasdaqEmbed] });
    }
  } catch (error) {
    log(`Error sending market update: ${error.message}`);
  }
}

/**
 * Start the automatic update interval
 */
function startAutoUpdates() {
  // Clear existing interval if it exists
  if (updateInterval) {
    clearInterval(updateInterval);
  }

  // Set up new interval
  updateInterval = setInterval(async () => {
    await updateAllMarketData();
    await sendMarketUpdate();
  }, CONFIG.UPDATE_INTERVAL);

  log(
    `Started auto-update interval (every ${CONFIG.UPDATE_INTERVAL / 60000} minutes)`,
  );
}

// Bot event handlers
client.on("ready", async () => {
  log(`Logged in as ${client.user.tag}`);

  // Initial update
  await updateAllMarketData();
  await sendMarketUpdate();

  // Start automatic updates
  startAutoUpdates();
});

client.on("messageCreate", async (message) => {
  // Ignore messages from bots or without prefix
  if (message.author.bot || !message.content.startsWith(CONFIG.PREFIX)) return;

  const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    if (command === "setup_channel") {
      if (!message.member.permissions.has("ADMINISTRATOR")) {
        return message.reply(
          "❌ You need administrator permissions to use this command!",
        );
      }

      targetChannelId = message.channelId;
      await message.reply(
        "✅ This channel has been set up for market updates!",
      );

      // Send initial update
      await updateAllMarketData();
      await sendMarketUpdate();
    }

    if (command === "market_update") {
      await updateAllMarketData();
      const forexEmbed = createForexEmbed();
      const goldEmbed = createGoldEmbed();
      const nasdaqEmbed = createNasdaqEmbed();

      await message.reply({ embeds: [forexEmbed] });
      await message.channel.send({ embeds: [goldEmbed] });
      if (nasdaqEmbed) {
        await message.channel.send({ embeds: [nasdaqEmbed] });
      }
    }

    if (command === "set_interval") {
      if (!message.member.permissions.has("ADMINISTRATOR")) {
        return message.reply(
          "❌ You need administrator permissions to use this command!",
        );
      }

      const minutes = parseInt(args[0]);
      if (isNaN(minutes)) {
        return message.reply("❌ Please specify a valid number of minutes");
      }

      if (minutes < 1 || minutes > 1440) {
        return message.reply(
          "❌ Please specify an interval between 1 and 1440 minutes (24 hours)",
        );
      }

      CONFIG.UPDATE_INTERVAL = minutes * 60 * 1000;
      startAutoUpdates();
      await message.reply(`✅ Update interval set to ${minutes} minutes`);
    }

    if (command === "logs") {
      if (!message.member.permissions.has("ADMINISTRATOR")) {
        return message.reply(
          "❌ You need administrator permissions to use this command!",
        );
      }

      try {
        const logData = fs.readFileSync("bot.log", "utf8");
        if (logData.length > 2000) {
          // If logs are too long, send as a file
          await message.reply({
            content: "Here are the bot logs:",
            files: [
              {
                attachment: Buffer.from(logData),
                name: "bot_logs.txt",
              },
            ],
          });
        } else {
          await message.reply(`\`\`\`\n${logData}\n\`\`\``);
        }
      } catch (error) {
        log(`Error reading log file: ${error.message}`);
        await message.reply("❌ Could not read log file");
      }
    }
  } catch (error) {
    log(`Error handling command ${command}: ${error.message}`);
    await message.reply("❌ An error occurred while processing your command");
  }
});

// Error handling
process.on("unhandledRejection", (error) => {
  log(`Unhandled promise rejection: ${error.message}`);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  log(`Login error: ${err.message}`);
  process.exit(1);
});
