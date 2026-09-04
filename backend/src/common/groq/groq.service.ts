import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { config } from "../../config/config";
import { LoggerService } from "../logger/logger.service";

type SubGroupInputBooking = {
  id: number;
  pnr: string;
  specialNotes?: string[];
  additionalNotes?: string | null;
};

type HotelScoreInput = {
  id: string;
  name: string;
  stars: number;
  amenities: string[];
  minRate: number;
  isAccessible: boolean;
  totalAvailableRooms: number;
};

@Injectable()
export class GroqService {
  private readonly apiKey = config.groq.apiKey;
  private readonly model = config.groq.model;
  private readonly apiUrl = "https://api.groq.com/openai/v1/chat/completions";

  constructor(private readonly logger: LoggerService) {}

  private buildDeterministicHotelScores(
    subGroupProfile: {
      needsProfile: string;
    },
    hotels: HotelScoreInput[],
  ): Array<{
    hotelId: string;
    score: number;
    reason: string;
  }> {
    const needsText = String(subGroupProfile.needsProfile ?? "").toLowerCase();
    const accessibilityNeeded = /accessib|wheelchair|mobility|medical/.test(
      needsText,
    );

    return [...hotels]
      .sort((a, b) => {
        const aRooms = Number.isFinite(a.totalAvailableRooms)
          ? a.totalAvailableRooms
          : 0;
        const bRooms = Number.isFinite(b.totalAvailableRooms)
          ? b.totalAvailableRooms
          : 0;
        const aRate = Number.isFinite(a.minRate) ? a.minRate : Number.MAX_VALUE;
        const bRate = Number.isFinite(b.minRate) ? b.minRate : Number.MAX_VALUE;

        if (accessibilityNeeded && a.isAccessible !== b.isAccessible) {
          return a.isAccessible ? -1 : 1;
        }
        if (a.stars !== b.stars) {
          return b.stars - a.stars;
        }
        if (aRooms !== bRooms) {
          return bRooms - aRooms;
        }
        return aRate - bRate;
      })
      .map((hotel, index) => {
        let score = 70 - index;
        if (accessibilityNeeded && hotel.isAccessible) {
          score += 15;
        }
        score += Math.min(10, Math.max(0, hotel.stars * 2));
        if (Number.isFinite(hotel.minRate)) {
          score += hotel.minRate <= 120 ? 5 : 0;
        }

        const boundedScore = Math.max(1, Math.min(100, score));
        const reasonParts = [
          `${hotel.stars}-star property`,
          `${hotel.totalAvailableRooms} rooms available`,
          accessibilityNeeded
            ? hotel.isAccessible
              ? "matches accessibility needs"
              : "limited accessibility match"
            : "ranked by quality and availability",
        ];

        return {
          hotelId: hotel.id,
          score: boundedScore,
          reason: reasonParts.join(", "),
        };
      });
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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Groq API returned status ${response.status}: ${errorText}`,
        );
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
      throw new ServiceUnavailableException(
        `Groq API recommendation failed: ${error.message}`,
      );
    }
  }

  async subGroupBySpecialNotes(
    classBookings: SubGroupInputBooking[],
    requestId: string,
  ): Promise<{
    subGroups: Array<{
      id: string;
      label: string;
      bookingIds: number[];
      needsProfile: string;
    }>;
  }> {
    if (!this.apiKey) {
      this.logger.warn(
        "Groq API Key is not configured.",
        "GroqService",
        requestId,
      );
      throw new ServiceUnavailableException("Groq API Key is not configured");
    }

    const systemPrompt = `You are an AI clustering assistant for hotel allocation.
Cluster bookings by semantic similarity of special needs using specialNotes and additionalNotes.

You MUST respond with a valid JSON object in this exact format:
{
  "subGroups": [
    {
      "id": "accessibility",
      "label": "Accessibility Requirements",
      "bookingIds": [10, 14],
      "needsProfile": "wheelchair access, ground floor rooms, accessible bathroom"
    }
  ]
}

Rules:
- bookingIds must only include IDs from the provided input.
- Every booking ID must appear in exactly one subgroup.
- Use stable subgroup IDs (kebab-case), and include a "standard" subgroup for generic/no-special-needs bookings.
- Return JSON only.`;

    const userPrompt = `Bookings to cluster:\n${JSON.stringify(classBookings, null, 2)}`;

    try {
      this.logger.info(
        "Calling Groq API for booking sub-grouping",
        "GroqService",
        requestId,
        { model: this.model, bookingCount: classBookings.length },
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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Groq API returned status ${response.status}: ${errorText}`,
        );
      }

      const responseData = await response.json();
      const content = responseData?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty message content received from Groq API");
      }

      const parsed = JSON.parse(content) as {
        subGroups?: Array<{
          id?: string;
          label?: string;
          bookingIds?: number[];
          needsProfile?: string;
        }>;
      };

      const knownIds = new Set(classBookings.map((booking) => booking.id));
      const validGroups = (parsed.subGroups ?? [])
        .map((group) => ({
          id: String(group.id ?? "standard").trim() || "standard",
          label: String(group.label ?? "Standard").trim() || "Standard",
          bookingIds: (group.bookingIds ?? []).filter((id) => knownIds.has(id)),
          needsProfile:
            String(group.needsProfile ?? "standard requirements").trim() ||
            "standard requirements",
        }))
        .filter((group) => group.bookingIds.length > 0);

      if (validGroups.length === 0) {
        return {
          subGroups: [
            {
              id: "standard",
              label: "Standard",
              bookingIds: classBookings.map((booking) => booking.id),
              needsProfile: "standard requirements",
            },
          ],
        };
      }

      return { subGroups: validGroups };
    } catch (error: any) {
      this.logger.error(
        `Failed to sub-group bookings with Groq API: ${error.message}`,
        "GroqService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `Groq API sub-grouping failed: ${error.message}`,
      );
    }
  }

  async scoreHotelsForSubGroup(
    subGroupProfile: {
      travelClass: string;
      classPriority: number;
      needsProfile: string;
      totalPassengers: number;
      bookingCount: number;
    },
    hotels: HotelScoreInput[],
    requestId: string,
  ): Promise<{
    scoredHotels: Array<{
      hotelId: string;
      score: number;
      reason: string;
    }>;
  }> {
    if (!this.apiKey) {
      this.logger.warn(
        "Groq API Key is not configured. Falling back to deterministic scoring.",
        "GroqService",
        requestId,
      );
      return {
        scoredHotels: this.buildDeterministicHotelScores(
          subGroupProfile,
          hotels,
        ),
      };
    }

    const systemPrompt = `You are an AI scoring assistant for flight-disruption hotel allocation.
Score each hotel from 1 to 100 for the provided subgroup profile.

You MUST return a valid JSON object in this exact format:
{
  "scoredHotels": [
    {
      "hotelId": "hb-1234",
      "score": 95,
      "reason": "5-star, fully accessible, restaurant on-site, 2km from airport"
    }
  ]
}

Rules:
- Include only hotelIds from the input list.
- Prefer hotels matching subgroup needs, class priority, available rooms, stars, and price suitability.
- Return JSON only.`;

    const userPrompt = JSON.stringify(
      {
        subGroup: subGroupProfile,
        hotels,
      },
      null,
      2,
    );

    try {
      this.logger.info(
        "Calling Groq API for subgroup hotel scoring",
        "GroqService",
        requestId,
        { model: this.model, hotelCount: hotels.length },
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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isJsonValidationError =
          response.status === 400 && /json_validate_failed/i.test(errorText);

        if (isJsonValidationError) {
          this.logger.warn(
            "Groq JSON-mode validation failed. Retrying without strict response_format.",
            "GroqService",
            requestId,
            { model: this.model },
          );

          const retryResponse = await fetch(this.apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: this.model,
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: `${userPrompt}\n\nReturn only valid JSON object with key \"scoredHotels\". No markdown fences.`,
                },
              ],
              temperature: 0.1,
            }),
          });

          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            throw new Error(
              `Groq API retry returned status ${retryResponse.status}: ${retryErrorText}`,
            );
          }

          const retryData = await retryResponse.json();
          const retryContent = retryData?.choices?.[0]?.message?.content;
          if (!retryContent) {
            throw new Error(
              "Empty message content received from Groq API retry",
            );
          }

          const parsedRetry = JSON.parse(retryContent) as {
            scoredHotels?: Array<{
              hotelId?: string;
              score?: number;
              reason?: string;
            }>;
          };

          const knownIds = new Set(hotels.map((hotel) => hotel.id));
          const retryScoredHotels = (parsedRetry.scoredHotels ?? [])
            .filter((hotel) => knownIds.has(String(hotel.hotelId ?? "")))
            .map((hotel) => ({
              hotelId: String(hotel.hotelId),
              score: Math.max(1, Math.min(100, Number(hotel.score ?? 50))),
              reason: String(hotel.reason ?? "No reason provided").trim(),
            }))
            .sort((a, b) => b.score - a.score);

          if (retryScoredHotels.length > 0) {
            return { scoredHotels: retryScoredHotels };
          }
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

      const parsed = JSON.parse(content) as {
        scoredHotels?: Array<{
          hotelId?: string;
          score?: number;
          reason?: string;
        }>;
      };

      const knownIds = new Set(hotels.map((hotel) => hotel.id));
      const scoredHotels = (parsed.scoredHotels ?? [])
        .filter((hotel) => knownIds.has(String(hotel.hotelId ?? "")))
        .map((hotel) => ({
          hotelId: String(hotel.hotelId),
          score: Math.max(1, Math.min(100, Number(hotel.score ?? 50))),
          reason: String(hotel.reason ?? "No reason provided").trim(),
        }))
        .sort((a, b) => b.score - a.score);

      if (scoredHotels.length === 0) {
        return {
          scoredHotels: this.buildDeterministicHotelScores(
            subGroupProfile,
            hotels,
          ),
        };
      }

      return { scoredHotels };
    } catch (error: any) {
      this.logger.warn(
        `Groq hotel scoring failed, using deterministic fallback: ${error.message}`,
        "GroqService",
        requestId,
      );
      return {
        scoredHotels: this.buildDeterministicHotelScores(
          subGroupProfile,
          hotels,
        ),
      };
    }
  }
}
