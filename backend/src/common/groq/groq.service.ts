import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { config } from "../../config/config";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class GroqService {
  private readonly apiKey = config.groq.apiKey;
  private readonly model = config.groq.model;
  private readonly apiUrl = "https://api.groq.com/openai/v1/chat/completions";

  constructor(private readonly logger: LoggerService) {}

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
        "Groq API Key is not configured.",
        "GroqService",
        requestId,
      );
      throw new ServiceUnavailableException("Groq API Key is not configured");
    }

    const systemPrompt = `You are an AI assistant for a flight cancellation management system (Flyvoid).
Your task is to analyze a passenger's booking details and recommend the most suitable hotels from a list of candidate hotels.

You MUST respond with a valid JSON object matching the following structure:
{
  "recommendations": [
    {
      "hotelId": "the ID of the recommended hotel",
      "score": 95, // numerical score from 1-100 indicating how well it matches passenger needs
      "suitabilityReason": "A detailed explanation of why this hotel fits the passenger's needs based on their travel class, special notes, and preferences."
    }
  ]
}

Ensure the recommendations are sorted by suitability score in descending order.`;

    const userPrompt = `Passenger details:
- Name: ${booking.firstName} ${booking.lastName}
- Travel Class: ${booking.travelClass}
- Party Size: ${booking.adults} Adults, ${booking.children} Children
- Special Requirements: ${booking.specialNotes?.join(", ") || "None"}
- Additional Notes: ${booking.additionalNotes || "None"}

Candidate Hotels:
${JSON.stringify(hotels, null, 2)}`;

    try {
      this.logger.info("Calling Groq API for hotel recommendation", "GroqService", requestId, { model: this.model });
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API returned status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      const content = responseData?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty message content received from Groq API");
      }

      const parsedData = JSON.parse(content);
      return parsedData;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch hotel recommendations from Groq API: ${error.message}`,
        "GroqService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(`Groq API recommendation failed: ${error.message}`);
    }
  }
}
