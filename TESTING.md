# Server library tests

## How to run

```sh
pnpm install
pnpm test
```

The suite is designed to run offline and uses mocks for all external services.

## Modules covered

| Module | Test file | Behavior covered |
| --- | --- | --- |
| `csvUtils.ts` | `src/lib/__tests__/csvUtils.test.ts` | Header cleanup, complete small CSVs, ten-row sampling, parser errors |
| `utils.ts` | `src/lib/__tests__/utils.test.ts` | Python fence extraction, class merging, timestamp formatting |
| `coding.ts` | `src/lib/__tests__/coding.test.ts` | Interpreter requests, response mapping, defaults, thrown errors, file arguments |
| `limits.ts` | `src/lib/__tests__/limits.test.ts` | Missing configuration, Upstash configuration, remaining counts, rejected requests |
| `chat-store.ts` | `src/lib/__tests__/chat-store.test.ts` | Missing and malformed values, message persistence, chat creation, title failures |

## What the tests found

- `coding.ts`: `runPython` accepts a `files` argument but never forwards it because the relevant line is commented out. Callers can believe their files are available to Python when they are silently dropped.
- `limits.ts`: when either Upstash environment variable is missing, both limit functions fall back to a full allowance and no enforcement. A deployment configuration mistake can therefore disable rate limiting without an error.
- `chat-store.ts`: saving a message for an unknown chat creates a record with null title and CSV fields. A bad or stale chat id can create an orphaned chat instead of being rejected.
