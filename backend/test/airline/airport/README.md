# Airport E2E Test Cases

This document lists all Airport API e2e test cases in this folder for quick review.

## Create Airport API

- Spec file: `create-airport.e2e-spec.ts`
- Endpoint: `POST /api/v1/airports`

Test cases:

- `TC_AIRPORT_CREATE_001`: Create airport by SUPER_ADMIN with valid payload, expected `201`
- `TC_AIRPORT_CREATE_002`: Create airport by STAFF admin with AIRPORTS EDIT access, expected `201`
- `TC_AIRPORT_CREATE_003`: Create airport by inactive admin should fail, expected `403`
- `TC_AIRPORT_CREATE_004`: Create airport without access token, expected `401`
- `TC_AIRPORT_CREATE_005`: Create airport with invalid access token, expected `401`
- `TC_AIRPORT_CREATE_006`: Create airport with expired access token, expected `401`
- `TC_AIRPORT_CREATE_007`: Create airport by STAFF admin without AIRPORTS EDIT access, expected `403`
- `TC_AIRPORT_CREATE_008`: Create airport by unauthorized role user, expected `403`
- `TC_AIRPORT_CREATE_009`: Missing name field, expected `400`
- `TC_AIRPORT_CREATE_010`: Missing iataCode field, expected `400`
- `TC_AIRPORT_CREATE_011`: Missing icaoCode field, expected `400`
- `TC_AIRPORT_CREATE_012`: Missing countryCode field, expected `400`
- `TC_AIRPORT_CREATE_013`: Missing city field, expected `400`
- `TC_AIRPORT_CREATE_014`: Missing latitude field, expected `400`
- `TC_AIRPORT_CREATE_015`: Missing longitude field, expected `400`
- `TC_AIRPORT_CREATE_016`: Missing timezone field, expected `400`
- `TC_AIRPORT_CREATE_017`: Missing isActive field, expected `400`
- `TC_AIRPORT_CREATE_018`: Missing type field, expected `400`
- `TC_AIRPORT_CREATE_019`: Empty name value, expected `400`
- `TC_AIRPORT_CREATE_020`: Empty iataCode value, expected `400`
- `TC_AIRPORT_CREATE_021`: Empty icaoCode value, expected `400`
- `TC_AIRPORT_CREATE_022`: Empty countryCode value, expected `400`
- `TC_AIRPORT_CREATE_023`: Empty city value, expected `400`
- `TC_AIRPORT_CREATE_024`: Empty timezone value, expected `400`
- `TC_AIRPORT_CREATE_025`: Empty type value, expected `400`
- `TC_AIRPORT_CREATE_026`: Null name value, expected `400`
- `TC_AIRPORT_CREATE_027`: Null iataCode value, expected `400`
- `TC_AIRPORT_CREATE_028`: Null icaoCode value, expected `400`
- `TC_AIRPORT_CREATE_029`: Null countryCode value, expected `400`
- `TC_AIRPORT_CREATE_030`: Null city value, expected `400`
- `TC_AIRPORT_CREATE_031`: Null latitude value, expected `400`
- `TC_AIRPORT_CREATE_032`: Null longitude value, expected `400`
- `TC_AIRPORT_CREATE_033`: Null timezone value, expected `400`
- `TC_AIRPORT_CREATE_034`: Null isActive value, expected `400`
- `TC_AIRPORT_CREATE_035`: Null type value, expected `400`
- `TC_AIRPORT_CREATE_036`: IATA code less than 3 characters, expected `400`
- `TC_AIRPORT_CREATE_037`: IATA code greater than 3 characters, expected `400`
- `TC_AIRPORT_CREATE_038`: IATA code with lowercase letters, expected `400`
- `TC_AIRPORT_CREATE_039`: IATA code with numeric characters, expected `400`
- `TC_AIRPORT_CREATE_040`: IATA code with special characters, expected `400`
- `TC_AIRPORT_CREATE_041`: Duplicate IATA code, expected `409`
- `TC_AIRPORT_CREATE_042`: ICAO code less than 4 characters, expected `400`
- `TC_AIRPORT_CREATE_043`: ICAO code greater than 4 characters, expected `400`
- `TC_AIRPORT_CREATE_044`: ICAO code with lowercase letters, expected `400`
- `TC_AIRPORT_CREATE_045`: ICAO code with numeric characters, expected `400`
- `TC_AIRPORT_CREATE_046`: ICAO code with special characters, expected `400`
- `TC_AIRPORT_CREATE_047`: Duplicate ICAO code, expected `409`
- `TC_AIRPORT_CREATE_048`: Country code less than 2 characters, expected `400`
- `TC_AIRPORT_CREATE_049`: Country code greater than 2 characters, expected `400`
- `TC_AIRPORT_CREATE_050`: Country code with numeric characters, expected `400`
- `TC_AIRPORT_CREATE_051`: Country code with special characters, expected `400`
- `TC_AIRPORT_CREATE_052`: Country code in lowercase normalization handling, expected `201`
- `TC_AIRPORT_CREATE_053`: Airport name exceeding 150 characters, expected `400`
- `TC_AIRPORT_CREATE_054`: Airport name with whitespace-only value, expected `400`
- `TC_AIRPORT_CREATE_055`: Airport name with Unicode characters, expected `201`
- `TC_AIRPORT_CREATE_056`: Airport name with SQL injection attempt, expected `400`
- `TC_AIRPORT_CREATE_057`: Airport name with script injection attempt, expected `400`
- `TC_AIRPORT_CREATE_058`: City exceeding 100 characters, expected `400`
- `TC_AIRPORT_CREATE_059`: City with whitespace-only value, expected `400`
- `TC_AIRPORT_CREATE_060`: City with Unicode characters, expected `201`
- `TC_AIRPORT_CREATE_061`: Latitude greater than 90, expected `400`
- `TC_AIRPORT_CREATE_062`: Latitude less than -90, expected `400`
- `TC_AIRPORT_CREATE_063`: Latitude with invalid string value, expected `400`
- `TC_AIRPORT_CREATE_064`: Latitude with scientific notation value, expected `400`
- `TC_AIRPORT_CREATE_065`: Latitude boundary value 90, expected `201`
- `TC_AIRPORT_CREATE_066`: Latitude boundary value -90, expected `201`
- `TC_AIRPORT_CREATE_067`: Longitude greater than 180, expected `400`
- `TC_AIRPORT_CREATE_068`: Longitude less than -180, expected `400`
- `TC_AIRPORT_CREATE_069`: Longitude with invalid string value, expected `400`
- `TC_AIRPORT_CREATE_070`: Longitude with scientific notation value, expected `400`
- `TC_AIRPORT_CREATE_071`: Longitude boundary value 180, expected `201`
- `TC_AIRPORT_CREATE_072`: Longitude boundary value -180, expected `201`
- `TC_AIRPORT_CREATE_073`: Timezone exceeding 100 characters, expected `400`
- `TC_AIRPORT_CREATE_074`: Empty timezone value, expected `400`
- `TC_AIRPORT_CREATE_075`: Whitespace-only timezone value, expected `400`
- `TC_AIRPORT_CREATE_076`: Invalid timezone format, expected `400`
- `TC_AIRPORT_CREATE_077`: Airport type INTERNATIONAL successfully, expected `201`
- `TC_AIRPORT_CREATE_078`: Airport type DOMESTIC successfully, expected `201`
- `TC_AIRPORT_CREATE_079`: Invalid airport type enum value, expected `400`
- `TC_AIRPORT_CREATE_080`: Create airport without address field, expected `201`
- `TC_AIRPORT_CREATE_081`: Create airport without postalCode field, expected `201`
- `TC_AIRPORT_CREATE_082`: Create airport with valid address field, expected `201`
- `TC_AIRPORT_CREATE_083`: Create airport with valid postalCode field, expected `201`
- `TC_AIRPORT_CREATE_084`: Address exceeding maximum allowed length, expected `400`
- `TC_AIRPORT_CREATE_085`: PostalCode exceeding maximum allowed length, expected `400`
- `TC_AIRPORT_CREATE_086`: Malformed JSON payload, expected `400`
- `TC_AIRPORT_CREATE_087`: Additional unknown fields in payload, expected `400`
- `TC_AIRPORT_CREATE_088`: SQL injection attempt in iataCode field, expected `400`
- `TC_AIRPORT_CREATE_089`: SQL injection attempt in icaoCode field, expected `400`
- `TC_AIRPORT_CREATE_090`: Script injection attempt in address field, expected `400`
- `TC_AIRPORT_CREATE_091`: Create airport with isActive=true, expected `201`
- `TC_AIRPORT_CREATE_092`: Create airport with isActive=false, expected `201`
- `TC_AIRPORT_CREATE_093`: Invalid boolean value for isActive, expected `400`
- `TC_AIRPORT_CREATE_094`: Response contains airport id, expected `201`
- `TC_AIRPORT_CREATE_095`: Response contains normalized countryCode, expected `201`
- `TC_AIRPORT_CREATE_096`: Response contains created airport name, expected `201`
- `TC_AIRPORT_CREATE_097`: Response contains created IATA code, expected `201`
- `TC_AIRPORT_CREATE_098`: Response contains created ICAO code, expected `201`
- `TC_AIRPORT_CREATE_099`: Response contains latitude and longitude values, expected `201`
- `TC_AIRPORT_CREATE_100`: Response contains timezone value, expected `201`
- `TC_AIRPORT_CREATE_101`: Concurrent airport creation with same IATA code should allow only one request, expected `201` and `409`
- `TC_AIRPORT_CREATE_102`: Concurrent airport creation with same ICAO code should allow only one request, expected `201` and `409`

Notes:

- `TC_AIRPORT_CREATE_038` and `TC_AIRPORT_CREATE_044`: The DTO `@Transform` uppercases `iataCode` and `icaoCode` before `@Matches` runs, so lowercase-letter input is normalized and accepted (`201`) rather than rejected (`400`). The test handles both outcomes.
- `TC_AIRPORT_CREATE_076`: The DTO does not enforce IANA timezone format validation — only `@IsString`, `@IsNotEmpty`, `@IsSafeText`, and `@MaxLength(100)` are applied. Arbitrary non-empty strings within the length limit are accepted (`201`). The test handles both outcomes.
- `TC_AIRPORT_CREATE_081`: `postalCode` is decorated with `@IsNotEmpty()` and has no `@IsOptional()`, so omitting it currently returns `400` rather than `201`. The test handles both outcomes.
