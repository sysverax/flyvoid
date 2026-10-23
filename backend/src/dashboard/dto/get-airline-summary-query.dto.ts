import { TimeFrameQueryDto } from "../../common/dto/time-frame-query.dto";

// Required timeFrame + IANA timezone, same as the trends.
export class GetAirlineSummaryQueryDto extends TimeFrameQueryDto {}
