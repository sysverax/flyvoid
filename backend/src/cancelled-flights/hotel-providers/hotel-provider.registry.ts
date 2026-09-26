import { Provider } from "@nestjs/common";
import { config } from "../../config/config";
import { HOTEL_PROVIDER } from "./hotel-provider.interface";
import { HotelbedsProvider } from "./hotelbeds/hotelbeds.provider";
import { RatehawkProvider } from "./ratehawk/ratehawk.provider";

// Every hotel supplier adapter. To add one, implement HotelProvider in its
// own folder and list it here; HOTEL_PROVIDER in the env picks the active one.
const HOTEL_PROVIDERS = {
  hotelbeds: HotelbedsProvider,
  ratehawk: RatehawkProvider,
} as const;

type HotelProviderName = keyof typeof HOTEL_PROVIDERS;

const selected = config.hotelProvider.name;
if (!(selected in HOTEL_PROVIDERS)) {
  throw new Error(
    `Unknown HOTEL_PROVIDER '${selected}'. Expected one of: ${Object.keys(HOTEL_PROVIDERS).join(", ")}`,
  );
}

export const hotelProviderRegistration: Provider = {
  provide: HOTEL_PROVIDER,
  useClass: HOTEL_PROVIDERS[selected as HotelProviderName],
};
