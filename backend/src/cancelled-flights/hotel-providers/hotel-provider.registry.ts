import { Injectable, Provider } from "@nestjs/common";
import { config } from "../../config/config";
import { HotelProviderCode } from "../../common/constants/hotel-provider.constants";
import { HOTEL_PROVIDER, HotelProvider } from "./hotel-provider.interface";
import { HotelbedsProvider } from "./hotelbeds/hotelbeds.provider";
import { RatehawkProvider } from "./ratehawk/ratehawk.provider";

// Every hotel supplier adapter. To add one, implement HotelProvider in its
// own folder and list it here; HOTEL_PROVIDER in the env picks the active one.
const HOTEL_PROVIDERS = {
  [HotelProviderCode.HOTELBEDS]: HotelbedsProvider,
  [HotelProviderCode.RATEHAWK]: RatehawkProvider,
} as const;

type HotelProviderName = keyof typeof HOTEL_PROVIDERS;

// Whether each supplier's credentials are set.
const CONFIGURED: Record<HotelProviderName, () => boolean> = {
  [HotelProviderCode.HOTELBEDS]: () =>
    !!config.hotelProvider.hotelbeds.apiKey &&
    !!config.hotelProvider.hotelbeds.secret,
  [HotelProviderCode.RATEHAWK]: () =>
    !!config.hotelProvider.ratehawk.apiKey &&
    !!config.hotelProvider.ratehawk.userId,
};

const selected = config.hotelProvider.name;
if (!(selected in HOTEL_PROVIDERS)) {
  throw new Error(
    `Unknown HOTEL_PROVIDER '${selected}'. Expected one of: ${Object.keys(HOTEL_PROVIDERS).join(", ")}`,
  );
}

/**
 * Every supplier adapter by provider code (providers.code). Each adapter is
 * created once and shared with HOTEL_PROVIDER, so a supplier keeps a single
 * rate limiter however many features call it.
 */
@Injectable()
export class HotelProviderRegistry {
  private readonly adapters: Record<HotelProviderName, HotelProvider>;

  constructor(hotelbeds: HotelbedsProvider, ratehawk: RatehawkProvider) {
    this.adapters = {
      [HotelProviderCode.HOTELBEDS]: hotelbeds,
      [HotelProviderCode.RATEHAWK]: ratehawk,
    };
  }

  private nameOf(code: string): HotelProviderName | null {
    const name = code.trim().toLowerCase();
    return name in HOTEL_PROVIDERS ? (name as HotelProviderName) : null;
  }

  /** The adapter for a provider code, or null when we have no adapter for it. */
  get(code: string): HotelProvider | null {
    const name = this.nameOf(code);
    return name ? this.adapters[name] : null;
  }

  /** True when we have an adapter for the code and its credentials are set. */
  isConfigured(code: string): boolean {
    const name = this.nameOf(code);
    return !!name && CONFIGURED[name]();
  }
}

export const hotelProviderRegistration: Provider[] = [
  HotelbedsProvider,
  RatehawkProvider,
  HotelProviderRegistry,
  {
    provide: HOTEL_PROVIDER,
    useExisting: HOTEL_PROVIDERS[selected as HotelProviderName],
  },
];
