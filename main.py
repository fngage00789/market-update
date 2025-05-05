import requests
from bs4 import BeautifulSoup
import yfinance as yf
from datetime import datetime
import time
import pytz

def get_gold_data():
    try:
        gold = yf.Ticker("GC=F")
        gold_info = gold.history(period="1d")
        
        if not gold_info.empty:
            current_price = gold_info['Close'].iloc[-1]
            prev_close = gold_info['Close'].iloc[-2] if len(gold_info) > 1 else current_price
            open_price = gold_info['Open'].iloc[-1]
            day_low = gold_info['Low'].iloc[-1]
            day_high = gold_info['High'].iloc[-1]
            change = current_price - prev_close
            change_percent = (change / prev_close) * 100
            
            utc_now = datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
            
            gold_output = f"""🏆 Gold Trading Data
Current gold prices as of {utc_now}
Gold Futures / US Dollar {'🟢' if change >= 0 else '🔴'}
Symbol: GC=F
Metal: XAU (Gold)
Currency: USD
Exchange: CMX
Current Price: ${current_price:,.3f}
Previous Close: ${prev_close:,.3f}
Open Price: ${open_price:,.3f}
Day Low: ${day_low:,.3f}
Day High: ${day_high:,.3f}
Change: {change:+.2f} ({change_percent:+.2f}%)
"""
            return gold_output
    except Exception as e:
        print(f"Error fetching gold data: {e}")
    return None

def get_forex_data():
    try:
        forex = yf.Ticker("EURUSD=X")
        forex_info = forex.history(period="1d")
        
        if not forex_info.empty:
            current_rate = forex_info['Close'].iloc[-1]
            prev_close = forex_info['Close'].iloc[-2] if len(forex_info) > 1 else current_rate
            open_rate = forex_info['Open'].iloc[-1]
            day_low = forex_info['Low'].iloc[-1]
            day_high = forex_info['High'].iloc[-1]
            change = current_rate - prev_close
            change_percent = (change / prev_close) * 100
            
            # Get 52-week range (approximation)
            yearly_data = forex.history(period="1y")
            year_low = yearly_data['Low'].min()
            year_high = yearly_data['High'].max()
            
            utc_now = datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
            
            forex_output = f"""Current rates as of {utc_now}
EUR/USD {'🟢' if change >= 0 else '🔴'}
Current Rate: {current_rate:.5f}
Previous Close: {prev_close:.5f}
Open: {open_rate:.5f}
Day Range: {day_low:.5f} - {day_high:.5f}
52 Week Range: {year_low:.5f} - {year_high:.5f}
Day Change: {change:+.5f} ({change_percent:+.2f}%)
Volume: 0
"""
            return forex_output
    except Exception as e:
        print(f"Error fetching forex data: {e}")
    return None

def get_nasdaq_data():
    try:
        nasdaq = yf.Ticker("^NDX")
        nasdaq_info = nasdaq.history(period="1d")
        
        if not nasdaq_info.empty:
            current_price = nasdaq_info['Close'].iloc[-1]
            prev_close = nasdaq_info['Close'].iloc[-2] if len(nasdaq_info) > 1 else current_price
            open_price = nasdaq_info['Open'].iloc[-1]
            day_low = nasdaq_info['Low'].iloc[-1]
            day_high = nasdaq_info['High'].iloc[-1]
            change = current_price - prev_close
            change_percent = (change / prev_close) * 100
            
            # Get 52-week data
            yearly_data = nasdaq.history(period="1y")
            year_low = yearly_data['Low'].min()
            year_high = yearly_data['High'].max()
            from_year_high = ((current_price - year_high) / year_high) * 100
            from_year_low = ((current_price - year_low) / year_low) * 100
            
            utc_now = datetime.now(pytz.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
            
            nasdaq_output = f"""Current price as of {utc_now}
^NDX {'🟢' if change >= 0 else '🔴'}
Index: NASDAQ-100 (NDX)
Current Price: {current_price:,.2f}
Previous Close: {prev_close:,.2f}
Open: {open_price:,.2f}
Day Range: {day_low:,.2f} - {day_high:,.2f}
52 Week Range: {year_low:,.2f} - {year_high:,.2f}
From 52W High: {from_year_high:+.2f}%
From 52W Low: {from_year_low:+.2f}%
Day Change: {change:+.2f} ({change_percent:+.2f}%)
Volume: {nasdaq_info['Volume'].iloc[-1]:,.0f}
Avg Volume (3m): 0
"""
            return nasdaq_output
    except Exception as e:
        print(f"Error fetching NASDAQ data: {e}")
    return None

def get_all_data():
    gold_data = get_gold_data()
    forex_data = get_forex_data()
    nasdaq_data = get_nasdaq_data()
    
    output = ""
    if gold_data:
        output += gold_data + "\n\n"
    if forex_data:
        output += forex_data + "\n\n"
    if nasdaq_data:
        output += nasdaq_data + "\n"
    
    return output.strip()

def auto_update(interval=300):  # 5 minutes by default
    while True:
        try:
            data = get_all_data()
            print(data)
            print("\n" + "="*50 + "\n")  # Separator between updates
        except Exception as e:
            print(f"Error during update: {e}")
        
        time.sleep(interval)

if __name__ == "__main__":
    # Initial data fetch
    print(get_all_data())
    
    # Start auto-update service
    auto_update()