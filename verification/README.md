# Reading management verification

## Rerun the model

Use Java 17 or later. Run this from the repository root with `ALLOY_JAR` pointing to the downloaded `org.alloytools.alloy.dist.jar`. [Alloy 6.2.0 release](https://github.com/AlloyTools/org.alloytools.alloy/releases/tag/v6.2.0)

```sh
alloy_output=$(mktemp -d)
java -jar "$ALLOY_JAR" exec -n -c '*' -o "$alloy_output" verification/readings.als
```

The output directory contains `receipt.json` and any witnesses or counterexamples. Each `check` should report `UNSAT` (no counterexample) and each `run` should report `SAT` (a witness exists).

## Results

Alloy 6.2.0 with SAT4J found no counterexamples for the seven assertions. The model uses two users, two days, four slots, and five reading identities. The empty state and individual transitions were checked in two-step traces. Every transition can end in a stuttering state, so these checks cover individual steps of sequences within the modeled scope. The full-day and occupied-move witnesses were found within eight transitions.

| Assertions                                                                     | Outcome              |
| ------------------------------------------------------------------------------ | -------------------- |
| Empty state, one row per slot, one position per reading, and four rows per day | No counterexample    |
| Returned rows and changes stay within the acting user's account                | No counterexample    |
| Rejected moves preserve the previous rows                                      | No counterexample    |
| Full day and occupied-move rejection                                           | Both witnesses found |

Removing the create operation's empty-slot guard in a temporary copy produced a `UniqueSlotsPreserved` counterexample. The model abstracts timestamps to calendar days and treats each write as an atomic operation. The API and PostgreSQL tests exercise timestamp conversion, access control, and actual concurrent writes.
