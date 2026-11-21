# 04. Reports

## Outcome

A signed-in patient can select one calendar date and get three reports for their own readings. This spec delivers the report API. The React spec will add the date picker, report presentation, and empty states.

## Calendar ranges

Calculate inclusive ranges from the selected date using calendar arithmetic. Query the `date` already stored for each reading in the account's reporting timezone.

| Report key | Range | Selected date `2026-10-15` |
| --- | --- | --- |
| `daily` | Selected date only | `2026-10-15` |
| `monthToDate` | First day of the selected month through the selected date | `2026-10-01` through `2026-10-15` |
| `monthly` | The entire calendar month immediately before the selected date's month | `2026-09-01` through `2026-09-30` |

January's previous month is December of the preceding year. February follows the leap-year calendar. The API accepts a future selected date and applies the same range rules. A future daily report is empty, while a future selection in the current month can still include earlier readings in month-to-date.

## HTTP contract

Use `GET /api/reports?date=YYYY-MM-DD` with `Authorization: Bearer <token>`. Return `401` if authentication fails and `400` with `{ "error": "message" }` if the date is missing, malformed, impossible, or has a previous month outside the supported calendar years. Use `req.userId` for the query and send `Cache-Control: no-store`.

The `200` response has `selectedDate`, `daily`, `monthToDate`, and `monthly`. Each report has `startDate`, `endDate`, and a `summary` with `highest`, `lowest`, `average`, and `count`. The daily report also has `readings` in slot order using the [reading response format](03-reading-management.md). Suggested response for one reading on the selected day:

```json
{
  "selectedDate": "2026-10-15",
  "daily": {
    "startDate": "2026-10-15",
    "endDate": "2026-10-15",
    "summary": { "highest": 110, "lowest": 110, "average": 110, "count": 1 },
    "readings": [
      {
        "id": "eb5f0f7d-c452-4986-b27c-0cb793cd48e4",
        "recordedAt": "2026-10-15T07:15:00.000Z",
        "date": "2026-10-15",
        "slot": "AFTER_LUNCH",
        "value": 110
      }
    ]
  },
  "monthToDate": {
    "startDate": "2026-10-01",
    "endDate": "2026-10-15",
    "summary": { "highest": 110, "lowest": 110, "average": 110, "count": 1 }
  },
  "monthly": {
    "startDate": "2026-09-01",
    "endDate": "2026-09-30",
    "summary": { "highest": null, "lowest": null, "average": null, "count": 0 }
  }
}
```

Highest and lowest are the original integer values in mg/dl. Average weights each reading equally and is rounded once to the nearest tenth, with ties rounded up. For example, an average of `100.25` becomes `100.3`. The API returns a number and the UI formats it with one decimal digit, including `110.0`. For an empty report, use zero count and `null` for all three measurements. An empty daily report also has `readings: []`. In the UI, show “No readings for this day” or “No readings for this period.”

## Implementation and verification

Read the signed-in user's rows from the start of the previous month through the selected date in one database query. The four-slot constraint bounds that query to at most 248 readings. Split the result into the three ranges and compute each summary from those rows. Reuse the reading serializer for the daily report and the existing calendar-date parser for input. A successful edit or delete is reflected on the next request.

1. Add unit tests for inclusive ranges, a selection on the first and last day of a month, January rollover, leap and common February, and average rounding. Compare generated reading sets with a simple reference calculation, including uneven numbers of readings across days.
2. Use real PostgreSQL fixtures just inside and outside each boundary. Check response shape, daily slot order, empty periods, a reading whose UTC date differs from its stored reporting date, and a second account with readings on the same dates. Verify that edits and deletes affect all applicable reports and that malformed requests receive the documented errors.
3. Add a bounded Alloy model of report membership with two users and ordered days spanning an older month, the previous month, and the selected month. Check that daily membership is included in month-to-date, previous-month membership is disjoint from both current-month reports, and reports include exactly the eligible rows for the signed-in user. Include a witness with readings in all three reports and one dated after the selection. The model treats calendar boundaries as inputs. The TypeScript and PostgreSQL tests verify the actual calendar calculations and numeric summaries.
4. Check that tests catch a one-day shift at a report boundary. Run the existing suites, lint, type checks, and Vite build. Record the Alloy bounds and results with the implementation.
