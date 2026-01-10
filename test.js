
const API_URL = "http://localhost:3000/api/stock"; 


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


    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text); 
    } catch {
      console.error(" Response is not JSON. Here's the raw response:\n", text);
      return;
    }

    console.log(" API Response:\n", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(" Error calling API:", err);
  }
}

testAPI(testSymbol);
