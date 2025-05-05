import os
import discord
from discord.ext import commands
from dotenv import load_dotenv
import yfinance as yf
import pandas as pd

# Load environment variables
load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
client = commands.Bot(command_prefix='!', intents=intents)

@client.event
async def on_ready():
    print(f'{client.user} has connected to Discord!')

@client.command()
async def gold(ctx):
    """Get current gold price"""
    try:
        gold_data = yf.Ticker("GC=F")
        price = gold_data.history(period='1d')['Close'].iloc[-1]
        change = gold_data.history(period='2d')['Close'].pct_change()[-1] * 100
        
        embed = discord.Embed(
            title="💰 Gold Price (COMEX)",
            description=f"${price:.2f} per troy ounce",
            color=0xFFD700
        )
        embed.add_field(
            name="24h Change",
            value=f"{'📈' if change >= 0 else '📉'} {abs(change):.2f}%",
            inline=True
        )
        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send("Couldn't fetch gold price. Try again later.")
        print(f"Gold Error: {e}")

@client.command()
async def forex(ctx, pair: str = "USD/EUR"):
    """Get currency exchange rates. Usage: !forex USD/EUR"""
    try:
        base, target = pair.upper().split('/')
        ticker = f"{base}{target}=X"
        forex_data = yf.Ticker(ticker)
        rate = forex_data.history(period='1d')['Close'].iloc[-1]
        change = forex_data.history(period='2d')['Close'].pct_change()[-1] * 100
        
        embed = discord.Embed(
            title=f"💱 {pair.upper()} Exchange Rate",
            description=f"1 {base} = {rate:.4f} {target}",
            color=0x3498DB
        )
        embed.add_field(
            name="24h Change",
            value=f"{'📈' if change >= 0 else '📉'} {abs(change):.2f}%",
            inline=True
        )
        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send("Invalid format or API error. Use: !forex BASE/TARGET (e.g., !forex USD/JPY)")
        print(f"Forex Error: {e}")

@client.command()
async def nas100(ctx):
    """Get NASDAQ 100 index data"""
    try:
        nasdaq_data = yf.Ticker("^NDX")
        price = nasdaq_data.history(period='1d')['Close'].iloc[-1]
        change = nasdaq_data.history(period='2d')['Close'].pct_change()[-1] * 100
        
        embed = discord.Embed(
            title="📊 NASDAQ 100 Index",
            description=f"${price:,.2f}",
            color=0x9B59B6
        )
        embed.add_field(
            name="24h Change",
            value=f"{'📈' if change >= 0 else '📉'} {abs(change):.2f}%",
            inline=True
        )
        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send("Couldn't fetch NASDAQ data. Try again later.")
        print(f"NASDAQ Error: {e}")

client.run(TOKEN)