import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { config } from "../../config/config";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class AiService {
  private readonly apiKey = config.ai.apiKey;
  private readonly model = config.ai.model;
  private readonly apiUrl = config.ai.apiUrl;
  private readonly temperature = config.ai.temperature;

  constructor(private readonly logger: LoggerService) {}

  private buildHotelRecommendationSystemPrompt(): string {
    return `You are an AI assistant for a flight cancellation management system (Flyvoid).
Your task is to analyze passenger booking context and recommend the most suitable hotels from a list of candidate hotels.

You MUST respond with a valid JSON object matching the following structure:
{
  "recommendations": [
    {
      "hotelId": "the ID of the recommended hotel",
      "score": 95,
      "suitabilityReason": "A detailed explanation of why this hotel fits the needs based on travel class, special notes, family profile, and preferences."
    }
  ]
}

Ensure the recommendations are sorted by suitability score in descending order.`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseJsonContent(content: string): any {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced ? fenced[1] : content).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      if (start !== -1 && end > start) {
        return JSON.parse(candidate.slice(start, end + 1));
      }
      throw new Error("AI response was not valid JSON");
    }
  }

  private async requestJsonFromAi(
    systemPrompt: string,
    userPrompt: string,
    requestId: string,
  ): Promise<any> {
    this.logger.info("Calling AI API", "AiService", requestId, {
      model: this.model,
    });

    // No response_format (reasoning models reject it). reasoning_effort low +
    // a completion cap stop gpt-oss burning its budget on thinking and
    // returning empty content.
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: this.temperature,
      reasoning_effort: "low",
      max_completion_tokens: 4000,
    });

    let responseData: any;
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body,
      });

      if (response.ok) {
        responseData = await response.json();
        break;
      }

      const errorText = await response.text();

      // Per-minute token limit hit (request fits, window is full): wait and retry.
      const retryMs = this.parseRetryDelayMs(response, errorText);
      if (response.status === 429 && retryMs !== null && attempt <= 2) {
        this.logger.warn(
          `AI API rate limited, retrying in ${retryMs}ms`,
          "AiService",
          requestId,
          { attempt },
        );
        await this.sleep(retryMs);
        continue;
      }

      throw new Error(`AI API returned status ${response.status}: ${errorText}`);
    }

    const message = responseData?.choices?.[0]?.message ?? {};
    const raw = message.content || message.reasoning;
    if (!raw) {
      throw new Error("Empty message content received from AI API");
    }

    return this.parseJsonContent(raw);
  }

  /** Retry delay for a 429, from Retry-After or the body's "try again in Xs". */
  private parseRetryDelayMs(
    response: Awaited<ReturnType<typeof fetch>>,
    errorText: string,
  ): number | null {
    const header = Number(response.headers.get("retry-after"));
    if (Number.isFinite(header) && header > 0) {
      return Math.min(header * 1000, 30_000) + 250;
    }
    const match = errorText.match(/try again in ([\d.]+)\s*s/i);
    if (match) {
      return Math.min(parseFloat(match[1]) * 1000, 30_000) + 250;
    }
    return null;
  }

  async getHotelRecommendations(
    booking: {
      firstName: string;
      lastName: string;
      travelClass: string;
      adults: number;
      children: number;
      specialNotes?: string[];
      additionalNotes?: string | null;
    },
    hotels: Array<{
      id: string;
      name: string;
      address: string;
      stars: number;
      amenities: string[];
      pricePerNight: number;
      description: string;
    }>,
    requestId: string,
  ): Promise<any> {
    if (!this.apiKey) {
      this.logger.warn(
        "AI API Key is not configured.",
        "AiService",
        requestId,
      );
      throw new ServiceUnavailableException("AI API Key is not configured");
    }

    const userPrompt = `Passenger details:
- Name: ${booking.firstName} ${booking.lastName}
- Travel Class: ${booking.travelClass}
- Party Size: ${booking.adults} Adults, ${booking.children} Children
- Special Requirements: ${booking.specialNotes?.join(", ") || "None"}
- Additional Notes: ${booking.additionalNotes || "None"}

Candidate Hotels:
${JSON.stringify(hotels, null, 2)}`;

    try {
      return await this.requestJsonFromAi(
        this.buildHotelRecommendationSystemPrompt(),
        userPrompt,
        requestId,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch hotel recommendations from AI API: ${error.message}`,
        "AiService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `AI API recommendation failed: ${error.message}`,
      );
    }
  }

  async rankHotelsForPassengerGroup(
    groupContext: {
      travelClass: string;
      passengerProfile: "standard" | "family";
      totalBookings: number;
      totalAdults: number;
      totalChildren: number;
      specialNotes: string[];
    },
    hotels: Array<{
      id: string;
      name: string;
      address: string;
      stars: number;
      amenities: string[];
      pricePerNight: number;
      description: string;
    }>,
    requestId: string,
  ): Promise<any> {
    if (!this.apiKey) {
      this.logger.warn(
        "AI API Key is not configured.",
        "AiService",
        requestId,
      );
      throw new ServiceUnavailableException("AI API Key is not configured");
    }

    const userPrompt = `Passenger group context:
- Travel Class: ${groupContext.travelClass}
- Group Type: ${groupContext.passengerProfile}
- Total Bookings: ${groupContext.totalBookings}
- Total Passengers: ${groupContext.totalAdults} adults, ${groupContext.totalChildren} children
- Special Requirements Across Group: ${groupContext.specialNotes.join(", ") || "None"}

Candidate Hotels:
${JSON.stringify(hotels, null, 2)}`;

    try {
      return await this.requestJsonFromAi(
        this.buildHotelRecommendationSystemPrompt(),
        userPrompt,
        requestId,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch group hotel recommendations from AI API: ${error.message}`,
        "AiService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `AI API recommendation failed: ${error.message}`,
      );
    }
  }
}
