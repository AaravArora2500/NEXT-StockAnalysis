from nsepython import nse_eq
from cachetools import TTLCache

# Cache results for 60 seconds (VERY important to avoid blocks)
cache = TTLCache(maxsize=100, ttl=60)

def get_nse_stock(symbol: str):
    symbol = symbol.upper()

    if symbol in cache:
        return cache[symbol]

    data = nse_eq(symbol)

    if not data:
        raise ValueError("Invalid NSE symbol")

    simplified = {
        "symbol": symbol,
        "latestPrice": data.get("priceInfo", {}).get("lastPrice"),
        "change": data.get("priceInfo", {}).get("change"),
        "changePercent": data.get("priceInfo", {}).get("pChange"),
        "dayHigh": data.get("priceInfo", {}).get("intraDayHighLow", {}).get("max"),
        "dayLow": data.get("priceInfo", {}).get("intraDayHighLow", {}).get("min"),
        "volume": data.get("securityWiseDP", {}).get("tradedVolume"),
        "lastUpdated": data.get("metadata", {}).get("lastUpdateTime"),
        "companyName": data.get("info", {}).get("companyName"),
        "industry": data.get("industryInfo", {}).get("industry"),
    }

    cache[symbol] = simplified
    return simplified
