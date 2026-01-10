// testBSEApi.js

// Replace with your local Next.js API URL
const API_URL = "http://localhost:3000/api/stock"; // <- update to your route

// The stock symbol you want to test
const testSymbol = "500325";

async function testAPI(symbol) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbol }),
    });

    // Try to parse JSON
    let data;
    const text = await response.text(); // get raw text first

    try {
      data = JSON.parse(text); // attempt to parse JSON
    } catch {
      console.error("⚠️ Response is not JSON. Here's the raw response:\n", text);
      return;
    }

    console.log("✅ API Response:\n", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ Error calling API:", err);
  }
}

testAPI(testSymbol);
