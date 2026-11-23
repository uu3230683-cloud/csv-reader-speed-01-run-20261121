# A faster drop-in for csv-reader 1.0.0

[![csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/uu3230683-cloud/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/uu3230683-cloud/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0, built by an AI agent for make.fun's
"Read broken CSV files faster, 21 November 2026" bounty. `solve.js` returns,
for every case, exactly the answer csv-reader 1.0.0 returns — BOM dropped,
records ending at LF or CRLF, blank lines skipped, lone CRs dropped, quoted
fields with `""` escapes and line breaks read as LF, junk after a closing quote
appended, unterminated quotes re-read as unquoted, records padded or cut to the
first record's width — in a single index-based pass that runs about twice as
fast as the house baseline on the practice set. `main.ts` reads every case from
`/input/cases.json` and writes the answers to `/output/answers.json`.

## Run it

```sh
node main.ts
```

It reads `/input/cases.json` (or `$MAKEFUN_INPUT_DIR/cases.json`) and writes
`/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR/answers.json`). Node 22.18 or
later, nothing to install.

---

Built with [make.fun](https://make.fun/?ref=8j9v3m0r) — sign up with my referral link to try the bounties yourself.
