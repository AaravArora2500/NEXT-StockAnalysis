import { NextResponse } from "next/server";

const ALPHA_API_KEY = process.env.ALPHA_API_KEY;

if (!ALPHA_API_KEY) {
  throw new Error("Missing ALPHA_API_KEY in environment variables");
}

async function searchSymbol(rawSymbol: string) {
  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${rawSymbol}&apikey=${ALPHA_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  const bestMatch = data.bestMatches?.[0];
  if (!bestMatch) return null;
  return bestMatch["1. symbol"];
}

async function getCompanyOverview(symbol: string) {
  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_API_KEY}`;
  const response = await fetch(url);
  return response.json();
}

function simplifyData(data: any) {
  const timeSeries = data["Time Series (Daily)"];
  const dates = Object.keys(timeSeries).slice(0, 30); 

  const history = dates.map((date) => ({
    date,
    close: parseFloat(timeSeries[date]["4. close"]),
    high: parseFloat(timeSeries[date]["2. high"]),
    low: parseFloat(timeSeries[date]["3. low"]),
    volume: parseInt(timeSeries[date]["5. volume"]),
  }));

  const latestPrice = history[0].close;
  const previousPrice = history[1].close;
  const change = ((latestPrice - previousPrice) / previousPrice) * 100;

  const avg30 = history.reduce((sum, h) => sum + h.close, 0) / history.length;
  const high52Week = Math.max(...history.map((h) => h.high));
  const low52Week = Math.min(...history.map((h) => h.low));
  const avgVolume = Math.round(history.reduce((sum, h) => sum + h.volume, 0) / history.length);

  return {
    latestPrice: latestPrice.toFixed(2),
    changePercent: change.toFixed(2),
    change: (latestPrice - previousPrice).toFixed(2),
    last5Days: history.slice(0, 5),
    last30Days: history,
    average30Day: avg30.toFixed(2),
    high52Week: high52Week.toFixed(2),
    low52Week: low52Week.toFixed(2),
    avgVolume,
    lastRefreshed: data["Meta Data"]["3. Last Refreshed"],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol: rawSymbol } = body;

    if (!rawSymbol) {
      return NextResponse.json({ error: "Stock symbol is required" }, { status: 400 });
    }

    const alphaSymbol = await searchSymbol(rawSymbol);
    if (!alphaSymbol) {
      return NextResponse.json(
        { error: `Could not find stock for "${rawSymbol}". Check the symbol or scrip code.` },
        { status: 404 }
      );
    }

    const priceRes = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${alphaSymbol}&apikey=${ALPHA_API_KEY}`
    );
    const priceData = await priceRes.json();

    // Rate limit handling
    if (priceData["Note"]) {
      return NextResponse.json(
        { error: "Data provider rate limit reached. Try again in 1 minute." },
        { status: 429 }
      );
    }

    if (!priceData["Time Series (Daily)"]) {
      return NextResponse.json(
        { error: `No price data found for ${alphaSymbol}.` },
        { status: 404 }
      );
    }

  
    const overviewData = await getCompanyOverview(alphaSymbol);


    const analysisReadyData = simplifyData(priceData);

    return NextResponse.json({
      success: true,
      inputSymbol: rawSymbol,
      alphaSymbol,
      ...analysisReadyData,
      companyInfo: {
        name: overviewData.Name || rawSymbol,
        description: overviewData.Description || "Information not available",
        sector: overviewData.Sector || "N/A",
        industry: overviewData.Industry || "N/A",
        marketCap: overviewData.MarketCapitalization || "N/A",
        peRatio: overviewData.PERatio || "N/A",
        dividendYield: overviewData.DividendYield || "N/A",
        profitMargin: overviewData.ProfitMargin || "N/A",
      },
      rawMeta: priceData["Meta Data"],
    });
  } catch (error) {
    console.error("BSE API Error:", error);
    return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
  }
}
