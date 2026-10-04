import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import puppeteer, { Browser } from "puppeteer";
import { Logger } from "winston";
import { LoggerService } from "../logger/logger.service";

// Shared across requests: launching Chromium per render would add ~1-2s to
// every call, so one browser instance is kept warm for the app's lifetime
// and a fresh page/tab is opened and closed per render.
@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly context = "PdfService";
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  constructor(private readonly logger: LoggerService) {}

  async onModuleInit(): Promise<void> {
    await this.getBrowser().catch((error: any) => {
      this.logger.warn(
        `PDF renderer failed to start at boot, will retry on first use: ${error?.message}`,
        this.context,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) {
      return this.browser;
    }
    if (!this.launching) {
      this.launching = puppeteer
        .launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        })
        .then((browser) => {
          this.browser = browser;
          this.launching = null;
          return browser;
        })
        .catch((error) => {
          this.launching = null;
          throw error;
        });
    }
    return this.launching;
  }

  /** Renders a self-contained HTML string (inline CSS; may reference Google Fonts) to a PDF buffer. */
  async renderHtmlToPdf(
    html: string,
    requestLogger: Logger,
    options?: { landscape?: boolean },
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });
      // Bounded wait so a slow/unreachable font CDN degrades to the fallback
      // font instead of hanging the request.
      await Promise.race([
        page.evaluateHandle("document.fonts.ready"),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => undefined);
      const pdf = await page.pdf({
        format: "A4",
        landscape: options?.landscape ?? false,
        printBackground: true,
        margin: { top: "18mm", bottom: "16mm", left: "14mm", right: "14mm" },
      });
      return Buffer.from(pdf);
    } catch (error: any) {
      requestLogger.error("Failed to render PDF", {
        context: this.context,
        error: error.message,
      });
      throw error;
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}
