import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import dotenv from "dotenv";
dotenv.config();

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("/api/*", cors());

let chrome = {};
let puppeteer;
let isLambda = process.env.AWS_LAMBDA_FUNCTION_VERSION

// Dynamic import tergantung lingkungan
if (isLambda) {
  chrome = await import("chrome-aws-lambda");
  puppeteer = await import("puppeteer-core");
} else {
  puppeteer = await import("puppeteer");
}

// Default route
app.get("/", (c) => c.text("Hono!"));

// Handler Screenshot
const handleScreenshot = async ({ url, device, format }) => {
  let options = {};

  if (isLambda) {
    options = {
      args: [...(chrome.args || []), "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    };
  } else {
    options = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };
  }

  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();

  // Set viewport
  if (device === "phone") {
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      deviceScaleFactor: 3,
    });
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1"
    );
  } else {
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2,
    });
  }

  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((res) => setTimeout(res, 30000)); // Delay 30 detik

  const buffer = await page.screenshot({ type: format, fullPage: true });
  await browser.close();

  return buffer;
};

// GET: /api/screenshot
app.get("/api/screenshot", async (c) => {
  const url = c.req.query("url");
  const device = c.req.query("device") || "desktop";
  const format = c.req.query("format") || "png";

  if (!url) {
    return c.json({ error: "Parameter url wajib diisi." }, 400);
  }

  try {
    const buffer = await handleScreenshot({ url, device, format });
    const filename = `deccay-${Date.now()}.${format}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": format === "png" ? "image/png" : "image/webp",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("❌ Error GET screenshot:", err);
    return c.json({ error: "Gagal mengambil screenshot" }, 500);
  }
});

// POST: /api/screenshot
app.post("/api/screenshot", async (c) => {
  const body = await c.req.json();
  const { url, device = "desktop", format = "png" } = body;

  if (!url || typeof url !== "string") {
    return c.json({ status: "error", message: "URL tidak valid." }, 400);
  }

  try {
    const buffer = await handleScreenshot({ url, device, format });
    const filename = `deccay-${Date.now()}.${format}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": format === "png" ? "image/png" : "image/webp",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("❌ Error POST screenshot:", err);
    return c.json({ status: "error", message: "Gagal mengambil screenshot." }, 500);
  }
});

export default app;
