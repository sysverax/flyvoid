import { types } from "pg";

// The database stores `timestamp` (without time zone) values in UTC, so the
// app runs in UTC and reads those values as UTC on any machine.
process.env.TZ = "UTC";

const parseTimestamptz = types.getTypeParser(types.builtins.TIMESTAMPTZ);
types.setTypeParser(types.builtins.TIMESTAMP, (value: string) =>
  parseTimestamptz(`${value}+00`),
);
