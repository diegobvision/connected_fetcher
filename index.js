// index.js

const puppeteer = require("puppeteer");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// ----------------------
// Supabase Configuration
// ----------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// -------------------------
// Scrape & Store Main Logic
// -------------------------
async function scrapeAndStore() {
  console.log("Scraping and storing data...");
  const browser = await puppeteer.launch({
    headless: true, // or false if you need to see the browser during debugging
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Use HTTP Basic Auth credentials before navigation.
  await page.authenticate({
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
  });

  try {
    // Navigate to the admin page (which is a frameset)
    await page.goto(process.env.URL, {
      waitUntil: "networkidle0",
    });

    // Wait for the frame named "content" to appear
    await page.waitForSelector('frame[name="content"]', { timeout: 10000 });

    // Find the frame with name "content"
    const frame = page.frames().find((f) => f.name() === "content");
    if (!frame) {
      throw new Error("Frame 'content' not found");
    }

    // Wait for the tables in the frame to load
    await frame.waitForSelector("table", { timeout: 20000 });
    const tables = await frame.$$("table");
    // Assuming the mount point stats table is the 4th table (index 3)
    if (tables.length < 4) {
      throw new Error(
        "Not enough tables in content frame; expected at least 4."
      );
    }
    const targetTable = tables[3];

    // Get all rows in the target table
    const rows = await targetTable.$$("tr");

    // Iterate through rows to find the one with "connected" in its first cell
    let connectedValue = null;
    for (const row of rows) {
      const cells = await row.$$("td");
      if (cells.length < 2) continue; // Skip rows that don't have at least two cells.

      // Get the text from the first cell
      const label = await frame.evaluate(
        (el) => el.textContent.trim(),
        cells[0]
      );
      if (label.toLowerCase() === "connected") {
        // Get the text from the second cell
        connectedValue = await frame.evaluate(
          (el) => el.textContent.trim(),
          cells[1]
        );
        break;
      }
    }

    if (!connectedValue) {
      throw new Error("Could not find the row labeled 'connected'.");
    }

    console.log("Retrieved connected value:", connectedValue);

    // ----------------------
    // Insert Data into Supabase
    // ----------------------
    const { data, error } = await supabase
      .from("connect_stats") // Adjust table name as needed.
      .insert([{ connected: connectedValue, created_at: new Date() }]); // Adjust column names as needed.

    if (error) {
      console.error("Error inserting into Supabase:", error);
    } else {
      console.log("Successfully stored the value in Supabase");
    }
  } catch (err) {
    console.error("Error in scrapeAndStore:", err);
  } finally {
    await browser.close();
  }
}

// ----------------------
// Run Immediately & Then
// Schedule to Run Hourly
// ----------------------
scrapeAndStore();
setInterval(scrapeAndStore, 3600000); // 1 hour in milliseconds
