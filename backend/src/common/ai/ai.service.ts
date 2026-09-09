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

  private async requestJsonFromAi(
    systemPrompt: string,
    userPrompt: string,
    requestId: string,
  ): Promise<any> {
    this.logger.info("Calling AI API", "AiService", requestId, {
      model: this.model,
    });

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
            content: systemPrompt,
          },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: this.temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (
        response.status === 400 &&
        errorText.includes("json_validate_failed")
      ) {
        this.logger.warn(
          "AI provider rejected strict JSON response format, retrying without response_format",
          "AiService",
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
                content: systemPrompt,
              },
              { role: "user", content: userPrompt },
            ],
            temperature: this.temperature,
          }),
        });

        if (!relaxedResponse.ok) {
          const relaxedErrorText = await relaxedResponse.text();
          throw new Error(
            `AI API returned status ${relaxedResponse.status}: ${relaxedErrorText}`,
          );
        }

        const relaxedData = await relaxedResponse.json();
        const relaxedContent = relaxedData?.choices?.[0]?.message?.content;
        if (!relaxedContent) {
          throw new Error("Empty message content received from AI API");
        }
        return JSON.parse(relaxedContent);
      }

      throw new Error(
        `AI API returned status ${response.status}: ${errorText}`,
      );
    }

    const responseData = await response.json();
    const content = responseData?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty message content received from AI API");
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

  private buildHotelAllocationSystemPrompt(): string {
    return `You are a hotel allocation assistant for an airline's flight disruption (delay/cancellation) passenger care process.

You will receive "occupancyGroups": passenger groups already clustered by identical room-occupancy requirement (same rooms/adults/children shape), each with a "hotels" shortlist of real, bookable offers already filtered for the right stay dates, distance from the airport, and room capacity.

Assign every passenger group (by passengerGroupId) to a specific hotel and room offer, referencing offers ONLY by their rateKey. Never restate a price, distance, or capacity - just choose from what's given.

HARD RULES - never break these:
1. Capacity: the assigned room(s) must fit the group's adults/children exactly.
2. Same hotel: every occupancyGroup that shares the same "sameHotelGroup" value must be assigned to the SAME hotelId (those rooms belong to one family/booking).
3. Allotment: never assign more rooms of the same rateKey, summed across ALL groups in this entire input, than that rate's "allotment" value. Track a running count as you go - this is a hard cap, not a preference. If a room's "allotment" is null, that rate is unavailable - never assign it.

SPECIAL NEEDS are advisory only. The hotel/room data has NO accessibility, medical, or dietary fields, so a specialNotes code can never be structurally verified - do NOT mark a group "unresolved" because of a special need, and never infer one from a room's name. Allocate the group normally by the priority order below; in its "reason", state which specialNotes codes were recorded and that they could not be confirmed from provider data and must be verified with the hotel directly.

PRIORITY ORDER - apply only among rooms that already satisfy the hard rules:
Rank travelClass as FIRST > BUSINESS > PREMIUM_ECONOMY > ECONOMY, and process groups in that order.
- FIRST groups get first pick of the highest-category (e.g. 5-star) hotels in their shortlist.
- BUSINESS groups pick next from what's left - still high category, but yield the single best hotel to FIRST class when allotment is tight.
- PREMIUM_ECONOMY groups get mid-tier rooms (4-star preferred, 3-star OK).
- ECONOMY groups get any comfortable, valid room. Don't force the cheapest option if a similarly priced better one is still available, but don't spend at FIRST-class levels either.
- Within the same class: special-needs groups first (give them the best-ranked hotel for their class tier), then groups with children/infants, then break remaining ties by bookingReference (alphabetical) for a consistent, repeatable result.

GROUPING: multiple passenger groups sharing one hotel and room type is expected and preferred, as long as allotment isn't exceeded - fill the best-ranked hotel for a class tier before spilling to the next one. Don't scatter groups across hotels for variety.

NEVER leave a group unassigned if any room satisfying hard rules 1-3 exists anywhere in its shortlist, even below its ideal category. Only use "unresolved" when nothing in the shortlist can satisfy hard rules 1-3.

Every assignment MUST include a one-sentence "reason" saying why this hotel and room is the best allocation for that group: name the class tier and how the hotel category fits it, note when it is a fallback below the group's ideal category, and add the special-needs caveat above when the group has any specialNotes.

Return STRICT JSON only, matching the schema in the user message. No prose, no markdown, nothing outside the JSON object.`;
  }

  async allocateHotelGroups(
    input: {
      occupancyGroups: Array<{
        passengerGroupId: string;
        sameHotelGroup: string;
        bookingReference: string;
        travelClass: string;
        specialNotes: string[];
        adults: number;
        children: number;
        roomsNeeded: number;
        hotels: Array<{
          hotelId: string;
          name: string;
          category: string;
          stars: number;
          rateKey: string;
          roomName: string;
          boardName: string;
          adults: number;
          children: number;
          allotment: number | null;
        }>;
      }>;
    },
    requestId: string,
  ): Promise<{
    assignments: Array<{
      passengerGroupId: string;
      hotelId: string;
      rateKey: string;
      roomsAssigned: number;
      reason: string;
    }>;
    unresolved: Array<{ passengerGroupId: string; reason: string }>;
  }> {
    if (!this.apiKey) {
      this.logger.warn("AI API Key is not configured.", "AiService", requestId);
      throw new ServiceUnavailableException("AI API Key is not configured");
    }

    const responseSchema = `RESPONSE SCHEMA (return exactly this shape, nothing else):
{
  "assignments": [
    { "passengerGroupId": "string", "hotelId": "string", "rateKey": "string", "roomsAssigned": number, "reason": "string" }
  ],
  "unresolved": [
    { "passengerGroupId": "string", "reason": "string" }
  ]
}`;

    const userPrompt = `${responseSchema}

INPUT:
${JSON.stringify(input, null, 2)}`;

    try {
      const result = await this.requestJsonFromAi(
        this.buildHotelAllocationSystemPrompt(),
        userPrompt,
        requestId,
      );
      return {
        assignments: Array.isArray(result?.assignments)
          ? result.assignments
          : [],
        unresolved: Array.isArray(result?.unresolved) ? result.unresolved : [],
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to allocate hotel groups via AI API: ${error.message}`,
        "AiService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `AI API allocation failed: ${error.message}`,
      );
    }
  }
}
