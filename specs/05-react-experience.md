# 05. React experience

## Outcome

A patient can register, sign in, log up to four readings on a day, and review all three reports from a responsive React interface. Use the existing Vite workspace and same-origin API proxy.

## Screens and interactions

- Provide sign-in and sign-up forms. Sign-up collects name, email, and password and sends the device's IANA timezone as the account reporting timezone. After registration, return to sign-in with the email filled in. Show server validation next to the form and keep entered fields when a request fails.
- Keep the one-hour bearer token in session storage so refreshing the tab restores the session through `/api/auth/me`. Signing out or receiving `401` on an authenticated request clears it and returns to sign-in. If session restoration fails because the server is unavailable, offer retry. Passwords stay out of browser storage.
- Open the logbook on today in the account's reporting timezone. One date control drives the four slots and all report summaries. Provide previous day, next day, and Today shortcuts. Allow dates up through today. Load the selected day's data from `/api/reports` and keep only the currently selected response visible. Show a retry action for a failed load.
- Give every empty slot an **Add reading** action. Filled slots show the value in mg/dl, the device-local reading time, and **Edit** and **Delete** actions. Once all four slots are filled, show “You can add only 4 readings per day.”
- Use one inline form for add and edit. It contains glucose value, slot, and local date and time. Set the initial slot from the action clicked. Validate missing values, whole numbers from 40–600, and future reporting dates. Show the API's slot-specific conflict message if the target slot is already occupied. Keep entered values after failed saves and prevent duplicate submissions while saving.
- Ask for confirmation before deleting. On successful saves or deletes, refresh the relevant report. If a save moves a reading to a different day, select its new reporting date so the saved reading is visible.
- Show each report's date range, highest, lowest, average, and reading count. Format averages with one decimal digit. The four-slot logbook supplies the daily report's reading list. Show “No readings for this day” or “No readings for this period” when a report is empty.

## Local time and reporting date

- Format reading times in the device's timezone. Render the device-local date alongside the time when it differs from the reporting date. Display the account's reporting timezone beside the logbook date so patients can see which calendar groups their readings.
- Interpret form dates and times in the device's timezone and send a full ISO 8601 timestamp. When starting a reading on today's reporting date, default to the current local time. For a past reporting day, start with noon in the account's reporting timezone converted to device-local time. Show the destination reporting date in the form when it differs from the local date entered.
- Use the browser Temporal polyfill for date and timezone conversion. Reject a local time skipped by a daylight saving transition. If a manually entered time occurs twice, use the first occurrence. When editing an existing reading, preserve its exact timestamp if the local date and time field stays unchanged. [Temporal timezone disambiguation](https://tc39.es/proposal-temporal/docs/timezone.html)

## Visual direction

Make the four ordered meal slots the main visual element. They sit on one horizontal rule on desktop and follow the same order in a vertical list on mobile. Large tabular glucose values and consistently placed empty-slot actions let a patient scan the day quickly. Daily statistics sit directly below the slots, with month-to-date and previous month beside each other on wide screens and stacked on narrow screens.

```text
Desktop
  Sweety                                              Sign out
  Blood glucose logbook        [ Previous ] [ Date ] [ Next ]
  Reporting timezone · Asia/Kolkata                   [ Today ]
  Fasting ───── After breakfast ───── After lunch ───── After dinner
  value/time    Add reading          value/time       Add reading
  Daily summary · highest / lowest / average / readings
  Month-to-date                        Previous month

Mobile
  Sweety                                      Sign out
  Blood glucose logbook
  [ Previous ] [ Date ] [ Next ]     [ Today ]
  Reporting timezone · Asia/Kolkata
  Fasting           value/time     Edit  Delete
  After breakfast   Add reading
  After lunch       value/time     Edit  Delete
  After dinner      Add reading
  Daily summary
  Month-to-date
  Previous month
```

Use pale blue `#EDF3F8` for the page, white `#FFFFFF` for surfaces, ink `#172840` for text, slate `#475B73` for secondary labels, blue-gray `#C8D6E4` for rules, and berry `#9E3056` for primary actions, focus, and errors. Use Bricolage Grotesque for headings and DM Sans for controls, text, and tabular numbers. The slot layout replaces the initial idea of a summary-card grid above the day. It puts logging first and preserves the sequence patients use to remember readings.

Use semantic controls, persistent field labels, visible focus, text error messages, and status announcements. Check keyboard access and focus return after saving or dismissing a form. Keep transitions brief and respect reduced-motion preferences.

## Verification

1. Add React Testing Library coverage for the reading form. Check required and out-of-range values, a server conflict, preservation of input after errors, and an edit that leaves the timestamp unchanged. Test time conversion for differing report and device dates and daylight saving transitions.
2. Exercise the complete React flow against the Compose API with synthetic data. Sign up, sign in, add and edit readings, fill the four slots, delete a reading, change the selected date, and verify the three summaries. Check refresh, sign-out, and an expired session.
3. Review at desktop and mobile widths. Verify that the four slots stay in order, the date controls fit, and forms and delete confirmation are usable by keyboard. Run frontend tests, the existing API suites, lint, type checks, and the Vite build.
