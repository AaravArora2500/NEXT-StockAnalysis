import { NextResponse } from "next/server";

const FASTAPI_URL = "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const symbol = body.symbol || body.messages?.at(-1)?.content?.split(" ").pop()?.replace(/[^a-zA-Z]/g, "");

    if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

    const res = await fetch(`${FASTAPI_URL}/stock/${symbol}`);
    if (!res.ok) throw new Error("FastAPI Unreachable");

    const result = await res.json();

    return NextResponse.json({
      success: true,
      symbol: result.data.symbol,
      price: result.data.latestPrice,
      change: result.data.changePercent,
      company: result.data.companyName,
      history: result.data.last30Days || []
    });
  } catch (err) {
    return NextResponse.json({ error: "Fetch error" }, { status: 500 });
  }
}