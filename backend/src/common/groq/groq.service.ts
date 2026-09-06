import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { config } from "../../config/config";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class GroqService {
  private readonly apiKey = config.groq.apiKey;
  private readonly model = config.groq.model;
  private readonly apiUrl = "https://api.groq.com/openai/v1/chat/completions";

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

  private async requestHotelRecommendationsFromGroq(
    userPrompt: string,
    requestId: string,
  ): Promise<any> {
    this.logger.info(
      "Calling Groq API for hotel recommendation",
      "GroqService",
      requestId,
      { model: this.model },
    );

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.buildHotelRecommendationSystemPrompt(),
          },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (
        response.status === 400 &&
        errorText.includes("json_validate_failed")
      ) {
        this.logger.warn(
          "Groq rejected strict JSON response format, retrying without response_format",
          "GroqService",
          requestId,
        );

        const relaxedResponse = await fetch(this.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: "system",
                content: this.buildHotelRecommendationSystemPrompt(),
              },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
          }),
        });

        if (!relaxedResponse.ok) {
          const relaxedErrorText = await relaxedResponse.text();
          throw new Error(
            `Groq API returned status ${relaxedResponse.status}: ${relaxedErrorText}`,
          );
        }

        const relaxedData = await relaxedResponse.json();
        const relaxedContent = relaxedData?.choices?.[0]?.message?.content;
        if (!relaxedContent) {
          throw new Error("Empty message content received from Groq API");
        }
        return JSON.parse(relaxedContent);
      }

      throw new Error(
        `Groq API returned status ${response.status}: ${errorText}`,
      );
    }

    const responseData = await response.json();
    const content = responseData?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty message content received from Groq API");
    }

    return JSON.parse(content);
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
        "Groq API Key is not configured.",
        "GroqService",
        requestId,
      );
      throw new ServiceUnavailableException("Groq API Key is not configured");
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
      return await this.requestHotelRecommendationsFromGroq(
        userPrompt,
        requestId,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch hotel recommendations from Groq API: ${error.message}`,
        "GroqService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `Groq API recommendation failed: ${error.message}`,
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
        "Groq API Key is not configured.",
        "GroqService",
        requestId,
      );
      throw new ServiceUnavailableException("Groq API Key is not configured");
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
      return await this.requestHotelRecommendationsFromGroq(
        userPrompt,
        requestId,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch group hotel recommendations from Groq API: ${error.message}`,
        "GroqService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `Groq API recommendation failed: ${error.message}`,
      );
    }
  }
}
