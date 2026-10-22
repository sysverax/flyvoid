import { TimeFrameQueryDto } from "../../common/dto/time-frame-query.dto";

// timeFrame + timezone, both required. Extend here if a trend needs more.
export class GetAirlineTrendQueryDto extends TimeFrameQueryDto {}
