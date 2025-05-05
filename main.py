import os
import discord
from discord.ext import commands
from dotenv import load_dotenv
import yfinance as yf
import pandas as pd
from datetime import datetime

# Initialize environment
load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
client = commands.Bot(command_prefix='!', intents=intents)

def get_market_data(ticker, period='2d'):
    """
    Get OHLCV + Change data using pandas
    Returns: Dictionary with price, change, range, volume
    """
    data = yf.Ticker(ticker).history(period=period)
    latest = data.iloc[-1]
    
    if len(data) > 1:
        prev_close = data.iloc[-2]['Close']
        change_pct = (latest['Close'] - prev_close) / prev_close * 100
    else:
        change_pct = 0
    
    return {
        'current': latest['Close'],
        'change': change_pct,
        'high': latest['High'],
        'low': latest['Low'],
        'volume': format_volume(latest['Volume']),
        'currency': get_currency(ticker),
        'time': latest.name.strftime('%Y-%m-%d %H:%M')
    }

def format_volume(volume):
    """Format volume for display"""
    if volume >= 1e9:
        return f"{volume/1e9:.2f}B"
    elif volume >= 1e6:
        return f"{volume/1e6:.1f}M"
    return f"{volume:,.0f}"

def get_currency(ticker):
    """Determine currency based on ticker"""
    if '=X' in ticker:
        return 'FX'
    elif ticker in ['GC=F', 'SI=F']:
        return 'USD'
    elif ticker == '^NDX':
        return 'USD'
    return 'USD'

@client.event
async def on_ready():
    print(f'{client.user.name} connected (ID: {client.user.id})')
    print(f'Bot ready at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')

@client.command()
async def gold(ctx):
    """Get spot gold prices with market data"""
    try:
        data = get_market_data("GC=F")
        
        embed = discord.Embed(
            title="💰 XAU/USD (Gold Spot)",
            description=f"**Current Price:** {data['currency']}{data['current']:,.2f}",
            color=0xFFD700,
            timestamp=datetime.now()
        )
        
        embed.add_field(name="24h Range", 
                      value=f"{data['currency']}{data['low']:,.2f} - {data['currency']}{data['high']:,.2f}", 
                      inline=True)
        
        embed.add_field(name="24h Change", 
                      value=f"{'📈' if data['change'] >=0 else '📉'} {abs(data['change']):.2f}%", 
                      inline=True)
        
        embed.add_field(name="Volume", 
                      value=data['volume'], 
                      inline=True)
        
        embed.set_footer(text=f"Last update: {data['time']} | Data via Yahoo Finance")
        
        await ctx.send(embed=embed)
        
    except Exception as e:
        await ctx.send("❌ Error fetching gold data. Try again later.")
        print(f"[GOLD ERROR] {datetime.now()}: {str(e)}")

@client.command()
async def nas100(ctx):
    """Get NASDAQ-100 index data"""
    try:
        data = get_market_data("^NDX")
        
        embed = discord.Embed(
            title="📊 NASDAQ-100 Index",
            description=f"**Current Price:** {data['currency']}{data['current']:,.2f}",
            color=0x9B59B6,
            timestamp=datetime.now()
        )
        
        embed.add_field(name="24h Range", 
                      value=f"{data['currency']}{data['low']:,.2f} - {data['currency']}{data['high']:,.2f}", 
                      inline=True)
        
        embed.add_field(name="24h Change", 
                      value=f"{'📈' if data['change'] >=0 else '📉'} {abs(data['change']):.2f}%", 
                      inline=True)
        
        embed.add_field(name="Volume", 
                      value=data['volume'], 
                      inline=True)
        
        embed.set_footer(text=f"Last update: {data['time']} | Data via Yahoo Finance")
        
        await ctx.send(embed=embed)
        
    except Exception as e:
        await ctx.send("❌ Error fetching NASDAQ data. Try again later.")
        print(f"[NASDAQ ERROR] {datetime.now()}: {str(e)}")

@client.command()
async def forex(ctx, pair: str = "USD/EUR"):
    """Get forex exchange rates (e.g. !forex USD/JPY)"""
    try:
        base, target = pair.upper().split('/')
        data = get_market_data(f"{base}{target}=X")
        
        embed = discord.Embed(
            title=f"💱 {pair.upper()} Exchange Rate",
            description=f"**1 {base} = {data['current']:.4f} {target}**",
            color=0x3498DB,
            timestamp=datetime.now()
        )
        
        embed.add_field(name="24h Range", 
                      value=f"{data['low']:.4f} - {data['high']:.4f}", 
                      inline=True)
        
        embed.add_field(name="24h Change", 
                      value=f"{'📈' if data['change'] >=0 else '📉'} {abs(data['change']):.2f}%", 
                      inline=True)
        
        embed.set_footer(text=f"Last update: {data['time']} | Data via Yahoo Finance")
        
        await ctx.send(embed=embed)
        
    except ValueError:
        await ctx.send("❌ Invalid format. Use: `!forex BASE/TARGET` (e.g. `!forex USD/JPY`)")
    except Exception as e:
        await ctx.send("❌ Error fetching forex data. Try again later.")
        print(f"[FOREX ERROR] {datetime.now()}: {str(e)}")

@client.command()
async def help_bot(ctx):
    """Show available commands"""
    embed = discord.Embed(
        title="📊 Market Bot Help",
        description="Real-time market data from Yahoo Finance",
        color=0x7289DA
    )
    
    embed.add_field(
        name="Available Commands",
        value=(
            "`!gold` - Spot gold prices (XAU/USD)\n"
            "`!nas100` - NASDAQ-100 index\n"
            "`!forex [pair]` - Forex rates (e.g. `!forex USD/JPY`)\n"
            "`!help_bot` - Show this help message"
        ),
        inline=False
    )
    
    embed.set_footer(text="Data updates may have 15-20 minute delay")
    await ctx.send(embed=embed)

client.run(TOKEN)