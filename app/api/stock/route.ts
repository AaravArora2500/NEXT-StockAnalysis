import { NextResponse } from "next/server";

const FASTAPI_URL = "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let symbol: string | undefined;

    if (typeof body.symbol === "string") {
      symbol = body.symbol.toUpperCase();
    }

    if (!symbol && Array.isArray(body.messages)) {
      const lastMessage = body.messages.at(-1)?.content;

      if (typeof lastMessage === "string") {
        const match = lastMessage
          .toUpperCase()
          .match(/\b[A-Z]{2,10}\b/);

        symbol = match?.[0];
      }
    }

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing stock symbol" },
        { status: 400 }
      );
    }

    const res = await fetch(`${FASTAPI_URL}/stock/${symbol}`, {
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(`FastAPI error: ${res.status}`);
    }

    const result = await res.json();

    return NextResponse.json({
      success: true,
      symbol: result?.data?.symbol ?? symbol,
      price: result?.data?.latestPrice ?? null,
      change: result?.data?.changePercent ?? null,
      company: result?.data?.companyName ?? null,
      history: result?.data?.last30Days ?? [],
    });
  } catch (err) {
    console.error("[STOCK API ERROR]", err);

    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 }
    );
  }
}
