from fastapi import FastAPI, HTTPException
from nse import get_nse_stock

app = FastAPI(title="Market Data Service")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/stock/{symbol}")
def fetch_stock(symbol: str):
    try:
        return {
            "success": True,
            "source": "NSE",
            "data": get_nse_stock(symbol)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
