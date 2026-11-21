# Formal verification

## Rerun the models

Use Java 17 or later. Run this from the repository root with `ALLOY_JAR` pointing to the downloaded `org.alloytools.alloy.dist.jar`. [Alloy 6.2.0 release](https://github.com/AlloyTools/org.alloytools.alloy/releases/tag/v6.2.0)

```sh
for model in readings reports; do
  alloy_output=$(mktemp -d)
  java -jar "$ALLOY_JAR" exec -n -c '*' -o "$alloy_output" "verification/$model.als"
  printf '%s results: %s\n' "$model" "$alloy_output"
done
```

The output directory contains `receipt.json` and any witnesses or counterexamples. Each `check` should report `UNSAT` (no counterexample) and each `run` should report `SAT` (a witness exists).

## Reading management results

Alloy 6.2.0 with SAT4J found no counterexamples for the seven assertions. The model uses two users, two days, four slots, and five reading identities. The empty state and individual transitions were checked in two-step traces. Every transition can end in a stuttering state, so these checks cover individual steps of sequences within the modeled scope. The full-day and occupied-move witnesses were found within eight transitions.

| Assertions                                                                     | Outcome              |
| ------------------------------------------------------------------------------ | -------------------- |
| Empty state, one row per slot, one position per reading, and four rows per day | No counterexample    |
| Returned rows and changes stay within the acting user's account                | No counterexample    |
| Rejected moves preserve the previous rows                                      | No counterexample    |
| Full day and occupied-move rejection                                           | Both witnesses found |

Removing the create operation's empty-slot guard in a temporary copy produced a `UniqueSlotsPreserved` counterexample. The model abstracts timestamps to calendar days and treats each write as an atomic operation. The API and PostgreSQL tests exercise timestamp conversion, access control, and actual concurrent writes.

## Report results

Alloy 6.2.0 with SAT4J found no counterexamples for the three report assertions. The model covers two users, six ordered days across three months, and six readings. Daily rows are included in month-to-date, previous-month rows are disjoint from both current-month reports, and each report includes exactly the eligible rows for the authenticated user.

The witness includes a reading in each report, a month-to-date reading from before the selected day, and excluded readings from an older month, a later date, and another user. The model treats month boundaries as inputs. The TypeScript and PostgreSQL tests check calendar arithmetic, stored reporting dates, and numeric summaries.

Excluding the selected day from the modeled query produced a `ReportsUseExactlyEligibleRows` counterexample. Shifting the previous-month start one day later in a temporary TypeScript copy caused the boundary tests to fail.
