# Renewal Prospecting Hub

A single-page web application for the Big Think Capital Renewals Division. It gives renewal closers and openers one place to see their month, prospect their book, work deals through closing, and track their own follow-ups.

It was built and tested as a claude.ai artifact against live Salesforce (Production) data, and is now hosted on Vercel with direct Salesforce REST API access, as a standalone link and as a Canvas app embedded in Salesforce. A native Salesforce build by the IT team remains the long-term option; see "Notes for the Salesforce build (IT)".

---

## Pages

The app has four tabs, in this order:

| Tab | Purpose |
|---|---|
| **Dashboard** | Month-to-date stats for the signed-in rep (team view for the manager). Default landing page. |
| **Renewal Prospecting Hub** | One filterable list of every funded account in the rep's book, replacing the per-rep report folders. |
| **Renewal Closing Hub** | Every deal the rep is working to close, from Underwriting through Sent to Operations. |
| **Hitlist** | A private, per-rep follow-up tracker. Nothing on it is written to Salesforce. |

URL hashes: `#dashboard` (default), `#prospecting`, `#closing`, `#hitlist`.

### Dashboard

Month-to-date stats, using the same rules as the Renewal MTD performance report.

- **Subs:** Opportunities with `Type LIKE '%Renewal%'` and `csbs__Underwriting_Date_Time__c` in the current month.
- **Approvals:** Of that same sub cohort, records with any non-null `csbs__Approved_Date_Time__c`, regardless of when the approval happened.
- **Funded:** `Type LIKE '%Renewal%'`, `StageName = 'Funded'`, `csbs__Funded_Date__c` in the current month.
- **Funded $:** sum of `csbs__Funded__c`. **Commission $:** sum of `csbs__Commission_Amount__c`.
- **Offer rate:** approvals ÷ subs. **Close rate:** funded ÷ approvals.
- **Attribution:** closers by `Renewal_Closer__r.Name`; openers by `Renewal_Opener__r.Name`.
- **Projections:** pace factor = business days in month ÷ business days elapsed (today counts as half elapsed). Applied to funded count and commission only.
- **Team Lead view:** the same as the manager view, limited to the reps listed on the lead's team plus the lead's own deals (for example, Sam Zorfas: Drew Larsen, James Nunnery, Musyoka Mbithi, Juan Espiritu, Austin Brown, and Sam). The Closing Hub is limited the same way.
- **Manager view:** closer-team totals, a ranked table of every rep sorted by commission, and a Closer Team Total row that counts closers only (openers are excluded to avoid double counting).

Also shows a commission-by-day chart, a "Right now" card (approved-not-funded, contracts out/in, aging approvals, Hitlist follow-ups due), and the rep's funded deals for the month.

### Renewal Prospecting Hub

- **Rows:** one per Account that has a funded deal. Deal terms come from the most recent funded opportunity (`Is_Most_Recent_Funded_Opportunity__c`). Stage and notes come from the most recent opportunity (`Is_Most_Recent_Opportunity__c`).
- **Book scoping:** by the Account owner's book (`Account.Owner.Renewal_Book__c`). Closers see their book plus House Book; openers and the manager see all books.
- **Always excluded:** `Do_Not_Contact__c`, `Exclude_From_Prospecting_List__c`, `Non_Marketing_List__c`.
- **Filter groups:** Deal status, Paydown, Paid in Full (by year funded or year paid off), Deal terms, Lender (include or exclude, with search), Activity (Last Note days), Signals (marketing source tags), Declines, Merchant, People.
- **Signals** read the `Assisted_by__c` multi-select picklist:

  | Button | Tag |
  |---|---|
  | SendBlue | SendBlue EPI |
  | TextUs | Marketing - TextUs (R) |
  | Apten | Marketing - Apten (R) |
  | Instantly | Instantly (R) |
  | Rebecca Miller | Marketing - RM |
  | Rachel Duncan | Marketing - RD |
  | Renewal Bot | Renewal Bot |

- **Quick starts:** a dropdown of preset filter sets, plus "Surprise Me."
- **My Lists:** named, saved filter sets per rep.
- **Lender eligibility:** rows are shaded by how close the funded deal is to its lender's renewal point (green = eligible, yellow = within 15 points, red = further away, no shading = no rule on file). Thresholds come from the BTC Lender Lookup matrix; where a lender gives a range, the lower number is used.
- **Working tags:** a tag shows when another rep left the most recent note in the last 7 days. Automated notes (integration users, forml) are ignored.
- **Peek panel:** clicking a row opens contact info, past fundings, offers (`csbs__Offer__c`), notes history (`ContentNote` through `ContentDocumentLink`), and opportunity history.
- **Account links:** account names open the Account record in Salesforce.
- **No export:** by design, there is no CSV or download option.

### Renewal Closing Hub

- **Stages:** Underwriting, Submitted, Resubmit, Sent to Lenders, Offers In, Pre-Approved, Approved, Contracts Out, Contracts In, Sent to Operations. SLOC Contracts In and Equipment Contracts In roll up under Contracts In.
- **Rep view:** deals where the rep is the Renewal Closer, Renewal Opener, or opportunity owner.
- **Manager view:** all deals with a renewal closer or opener, with closer and opener filters.
- **Aging approvals:** Approved for 7+ days. Flagged and filterable.

### Hitlist

- **Purpose:** a private follow-up tracker modeled on a rep's existing Excel workflow. Each rep can add prospects from the Prospecting Hub (or by name) and track status, follow-up date, opener, contact method, marketing, a note to self, and a dated activity log.
- **Statuses:** 1 - Prospect, 2 - Pending Banks, 3 - Submitted, 4 - Approved, 5 - 2nd Call, 6 - Pitched, 7 - Contracts Out, 8 - Funded, 9 - Sent Links, 10 - Merchant Decline, 11 - Funders Decline, 12 - DNC.
- **Live data:** paid-in % and eligibility are read live from Salesforce. Nothing is ever written to Salesforce.
- **Privacy:** each rep can read and edit only their own Hitlist. The manager (page owner) can view any rep's Hitlist read-only.

---

## How it runs

The application is deployed on Vercel. It reads Salesforce directly through the Salesforce REST API using each viewer's own Salesforce login, so Salesforce sharing rules and field-level security apply to every query. It no longer depends on the claude.ai runtime or the MCP Host connector.

`app/index.html` is the original claude.ai artifact, unchanged. When the page is served, `api/app.js` adds `public/rph-runtime.js`, which provides the same `window.claude.use("mcp" | "db" | "user")` interface the artifact expects, backed by this deployment's API:

| Artifact capability | Replaced by | Backing service |
|---|---|---|
| `mcp` (`sfprod__soql_query`) | `POST /api/soql` | Salesforce REST API `/services/data/<version>/query`, with the viewer's OAuth token. Read-only (SELECT only). |
| `db` (saved lists, Hitlists) | `GET / PUT / DELETE /api/db` | Upstash Redis. Access rules from `capabilities.json` are enforced server-side in `lib/store.js`. |
| `user` (identity, page owner) | `GET /api/me` | Salesforce user info. "Page owner" (manager) is any email listed in `MANAGER_EMAILS`. |

Because the artifact file is unchanged, a new version exported from claude.ai can be dropped into `app/index.html` and redeployed.

### Theme layer (Renewals HQ)

`public/rph-theme.css` and `public/rph-theme.js` restyle the page without changing `app/index.html`. They are injected by `api/app.js` after the page's own styles and scripts. Patterns are adapted from React Bits Pro (`app-shell-1`, `navigation-1`, `app-sidebar`, `data-table`) and reimplemented in plain CSS and JavaScript, because the page has no React build step.

- **Header:** Big Think Capital logo, "Renewals HQ" title, icon pill navigation with a sliding active indicator, and an account menu (name, email, Open Salesforce, Sign out). Managers find the "Viewing as" picker inside the account menu; reps do not see it.
- **Logo:** place the logo at `public/brand/logo.svg` (or `public/brand/logo.png`), sized for a dark background. Until a file is present, a text wordmark is shown.
- **Collapsible filter sidebar:** collapses to a narrow rail with Expand and Run buttons.
- **Row size:** Compact, Default and Comfortable row heights, available on every table toolbar.
- Sidebar state and row size are remembered per browser (local storage) and are not shared or stored on the server.

### Sign-in

- **Standalone link:** visiting the site redirects to Salesforce login (OAuth 2.0 web server flow with PKCE). Tokens are kept in an encrypted, HttpOnly session cookie (12 hours) and are never exposed to page scripts. Access tokens are refreshed automatically when a refresh token is available.
- **Inside Salesforce:** the app is a Salesforce Canvas app. Salesforce posts a signed request to `/api/canvas`; the signature is verified with the Connected App consumer secret and the session starts without a second login.

### Identity lock

The prototype's "Viewing as" selector is locked to the signed-in Salesforce user. Only users listed in `MANAGER_EMAILS` can change it. The signed-in user's Salesforce name must match a name in the `PEOPLE` roster in `app/index.html`; users not on the roster see a notice and no data is loaded.

### Routes

| Route | Purpose |
|---|---|
| `/` | The application (requires sign-in). |
| `/api/auth/login`, `/api/auth/callback` | Salesforce OAuth sign-in. |
| `/api/auth/logout` | Ends the session. |
| `/api/canvas` | Salesforce Canvas signed-request entry point. |
| `/api/me` | Signed-in user identity. |
| `/api/soql` | Read-only SOQL proxy. |
| `/api/db` | Saved lists and Hitlist storage. |

### Known limitations

- **Record visibility:** Salesforce sharing is the security boundary. Every query runs as the signed-in user, so the app can never return a record that user cannot already see in Salesforce. Organization-wide defaults for Account, Opportunity and Lead are Private, and no renewal profile has View All Data, so visibility is determined by role hierarchy and sharing rules. The page's book filter only narrows results further for convenience. To change what a rep can see, change Salesforce sharing rules, not the app.
- **Safari inside Salesforce:** the embedded Renewals HQ tab relies on partitioned third-party cookies, which Chrome and Edge support. Safari users should use the standalone link.
- **Storage refresh:** saved lists and Hitlists refresh every 20 seconds and immediately after the viewer's own changes, rather than in real time.

## Deployment

### 1. Salesforce External Client App (Salesforce admin)

The production org uses an External Client App named **Renewal Prospecting Hub**.

Setup → External Client App Manager → Renewal Prospecting Hub:

1. **Settings → OAuth:** enabled.
   - Callback URL: `https://renewal-prospecting-hub.vercel.app/api/auth/callback`
   - OAuth scopes: `api`, `refresh_token offline_access`, `openid`.
   - Require PKCE, require secret for the Web Server flow and for the Refresh Token flow.
2. **Settings → Canvas:** enabled.
   - Canvas App URL: `https://renewal-prospecting-hub.vercel.app/api/canvas`
   - Access Method: `Signed Request (POST)`
   - Locations: `Lightning Component`, `Visualforce Page`.
3. **Policies → OAuth Policies:** Permitted Users = `Admin approved users are pre-authorized`. Selected permission set: **Renewal Prospecting Hub Access** (`Renewal_Prospecting_Hub_Access`).
4. Copy the Consumer Key and Consumer Secret into the Vercel environment variables.

**Access:** users must be assigned the `Renewal_Prospecting_Hub_Access` permission set. It is assigned to all active users whose profile name contains "Renewal" and to the system administrator. New renewal hires must be assigned it manually:

```bash
sf org assign permset -o prod -n Renewal_Prospecting_Hub_Access -b <username>
```

**Salesforce tab (Renewals HQ):** a Lightning App Page named **Renewals HQ** (one region) contains the standard Canvas App component pointing at the app's API name, height 1400 px, border hidden. It is activated as a Lightning tab in the Renewals Lightning app and made visible through the renewal profiles or the permission set.

### 2. Vercel

1. Import this repository as a new Vercel project (framework preset: Other; no build command).
2. Storage → Marketplace → add **Upstash Redis** and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Set the remaining environment variables (see `.env.example`):

| Variable | Value |
|---|---|
| `SF_CLIENT_ID` | Connected App Consumer Key |
| `SF_CLIENT_SECRET` | Connected App Consumer Secret |
| `SF_LOGIN_URL` | `https://login.salesforce.com` (or the My Domain login URL) |
| `SF_API_VERSION` | Optional. Defaults to `v62.0`. |
| `APP_URL` | Public URL of the deployment, with no trailing slash |
| `SESSION_SECRET` | Random string of 32+ characters (for example, `openssl rand -base64 48`) |
| `MANAGER_EMAILS` | Comma-separated Salesforce emails of users who get the Manager view |

4. Redeploy after setting variables.

### Local tests

```bash
npm test
```

## Configuration

These values live as constants near the top of the `<script>` block in `app/index.html`:

| Constant | What it holds |
|---|---|
| `SF_BASE` | Salesforce Lightning base URL used for record links. |
| `PEOPLE` | Team roster: name, role (Manager, Team Lead, Closer, Opener), book, and for a Team Lead the list of reps on their team. Update when reps join, leave, or change books. |
| `LENDERS` | Lender names offered in the Lender filter. |
| `ELIG` | Lender renewal-eligibility thresholds (% paid in). |
| `PRESETS` | Quick-start filter sets. |
| `CH_STAGES`, `CH_ALIAS` | Closing Hub stages and stage roll-ups. |
| `HL_STATUSES`, `HL_CONTACT`, `HL_MKT`, `HL_OPENERS` | Hitlist picklists. |

---

## Notes for the Salesforce build (IT)

Requirements carried over from the prototype:

1. **Book lock:** enforce book scoping server-side from the logged-in user (for example, an Apex controller for a Lightning Web Component). A report filter alone is not sufficient because users can save copies without it.
2. **Access:** openers and the manager have access to all books.
3. **Account links:** the account name always links to the Account record.
4. **No exports:** no export or download option, and the Export Reports permission disabled for the renewal rep profiles.
5. **Saved lists:** per-user saved filter sets (list views or a small custom object).
6. **Hitlist:** a custom object owned by the rep with private sharing, readable by the manager through the role hierarchy. It must not update Account or Opportunity records.
7. **Lender eligibility:** thresholds should be maintained in custom metadata so they can be updated without code changes.
8. **Filter definitions:** all filter and metric definitions are documented above and implemented in `buildWhere()`, `loadClosing()` and `loadDash()` in `index.html`.

---

## Repository contents

```
app/index.html          The application (original claude.ai artifact, unchanged)
app/capabilities.json   Original claude.ai capability declaration (reference for access rules)
public/rph-runtime.js   Browser adapter that replaces the claude.ai runtime
public/rph-theme.*      Renewals HQ theme layer (header, navigation, sidebar, row size)
public/brand/           Logo files
api/                    Vercel serverless functions (auth, Canvas, SOQL proxy, storage)
lib/                    Session, Salesforce and storage helpers
test/                   Unit tests
vercel.json             Routing, function and security header configuration
.env.example            Required environment variables
README.md               This file
```

This repository contains internal team names and business rules. Keep it private. The deployed page is served only to signed-in Salesforce users.
