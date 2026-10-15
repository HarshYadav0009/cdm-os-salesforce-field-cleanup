# Frontend verification — 15 October 2026

Validated against the running frontend on port 3000, Control Plane on port 8000, and Tool Gateway on port 8080. The gateway reported a real Salesforce sandbox connection. No approval, rejection, execution, or field mutation was submitted during live verification.

| Check | Result |
| --- | --- |
| Automated contract and component-helper tests | 43 passed |
| TypeScript | Passed |
| ESLint | Passed |
| Production build (`next build --webpack`) | Passed |
| Both service health indicators | Online |
| Eight navigation pages | Loaded without reported API or runtime errors |
| Rejected proposal history | 8 rows displayed |
| Existing proposal timeline | 2 linked events displayed |
| Audit signatures | Signature display and copy controls present |
| Policy Manager | Live rules and enforcement mode displayed |
| Contact bulk scan | 14 fields: 4 cleanup candidates, 1 need review, 9 active |
| Bulk review → automatic dependency analysis | Exactly one usage request and one reference request |
| Direct field analysis | Live Account.Id assessment displayed |
| Mobile layout at 390 × 844 | No horizontal document overflow |
| Browser runtime/API errors | None observed in the final run |

Live verification exposed an incompatible Policy Manager response. The frontend now accepts both policy arrays and the backend's loaded configuration. Live agent metadata and registered tool tiers are also retained when supplied.

The repeatable read-only browser harness is `tests/live-frontend.mjs`. It requires Playwright and Google Chrome; `PLAYWRIGHT_MODULE` can point to an external Playwright installation. It blocks browser requests that would write agent or proposal state. Results and screenshots are saved under the ignored `test-results/` directory.

## Verification limits

Proposal creation, human decisions, and execution requests are covered by automated tests with controlled API responses. They were not submitted to the live backend. Real Salesforce deprecation, deletion, backup/rollback, and post-change verification remain unverified end to end. This report does not claim that those operations succeeded.
