### Planning Center – Context Engineering Brief

*(Optimized for AI LLM coding agents who will extend or modernize a local church‑management system.)*

---

## 1  Product Overview & Business Value

| Aspect         | Summary                                                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**    | Planning Center (PC) is a modular Church Management System (ChMS) built around a single **People** database. It lets ministries **organize data, coordinate events, plan services, communicate, and receive donations** from one integrated SaaS platform. ([Planning Center][1])                      |
| **Core Value** | • Single source of truth for member data<br>• Specialized modules (Giving, Check‑Ins, etc.) that share the same person IDs<br>• Self‑service Church Center app + web site for congregants (giving, event sign‑ups, volunteer scheduling, mobile check‑in) ([Planning Center][2], [Planning Center][3]) |
| **API‑first**  | One JSON‑API‑compliant REST API spans the suite (currently People, Calendar, Check‑Ins, Giving, Groups, Services; others planned). ([Planning Center][4], [Rollout][5])                                                                                                                                |

---

## 2  Module‑by‑Module Breakdown

> **Legend:** **CF** = Core Functionality • **UF** = Key User Flow • **DEP** = Dependencies (all assume a `person_id` link to People) • **AC** = Acceptance Criteria (when “done”).

| Module                       | CF (Feature Set)                                                                                                                                                                            | Typical UF                                                                                                                | DEP                                                                                          | AC (high‑level “Definition of Done”)                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **People**                   | ‑ Profile w/ built‑in & **custom fields**, forms, household & campus grouping, bulk text/email, CSV import/export. ([Planning Center][6], [pcopeople.zendesk.com][7], [Planning Center][8]) | Staff creates person → assigns tags / custom fields → person self‑updates via Church Center.                              | Central DB for every other module.                                                           | - Can CRUD profiles, custom fields & tags<br>- Forms create/update profiles<br>- Bulk ops (list, export, bulk SMS) work under permission controls |
| **Giving**                   | Online & offline donations, batch entry, Stripe payments, ACH, pledge campaigns, funds, tax receipts, import history. ([Planning Center][9], [Planning Center][9])                          | Donor taps “Give” in Church Center → selects fund → pays → receipt emailed; finance team reviews batch & exports reports. | Needs `person_id`; Fund list shared with Reports/Metrics.                                    | - Stripe & ACH integration working<br>- PCI‑compliant tokenization<br>- Donation linked to person & fund<br>- CSV export & year‑end statements    |
| **Check‑Ins**                | Child & volunteer attendance, label printing, station modes (Manned, Self, Roster), secure checkout. ([Planning Center][3], [Planning Center][10])                                          | Family scans QR at Self station → labels print → attendance recorded; guardian provides code at pick‑up.                  | Event/Service schedule from Services; rooms from Calendar/Resources.                         | - <5 s check‑in time<br>- Duplicate prevention<br>- Security code validation<br>- Badge/label template designer                                   |
| **Registrations (Sign‑Ups)** | Paid/free event sign‑ups, selection types, capacity, discounts, payment plans. ([YouTube][11], [YouTube][12])                                                                               | Member selects event → chooses options (e.g., room type) → pays → receives confirmation email & appears on roster.        | Payments via Giving; events surfaced in Calendar; participants → People.                     | - Tiered pricing & add‑ons<br>- Wait‑list auto‑promote<br>- Partial payments & refunds<br>- Roster export                                         |
| **Groups**                   | Public group directory, join requests, attendance, member messaging/rosters, resources. ([Planning Center][13], [Planning Center][2])                                                       | User browses directory → submits join request → leader approves → attendance tracked each meeting.                        | Group members are Person links; event dates push to Calendar; attendance influences Metrics. | - Self‑service join/leave<br>- Attendance entry per meeting<br>- Leader permissions enforcement                                                   |
| **Services**                 | Worship plan builder, song library, volunteer scheduling, rehearsal files, Music Stand app. ([Planning Center][14], [Planning Center][14])                                                  | Planner builds order of service → auto‑sends schedule → volunteers confirm → team rehearses via mobile app.               | Volunteers = People; plan dates create Check‑Ins events; files stored in cloud.              | - Drag‑drop plan editor<br>- Conflict checks on volunteer schedules<br>- Mobile rehearsal media playable                                          |
| **Calendar**                 | Central event calendar, facility & resource reservation, conflict detection, iCal import/export. ([Planning Center][15], [Planning Center][16])                                             | Staff requests room/resource → approvals flow → event publishes to Church Center & feeds Google Calendar via iCal.        | Room & resource entities (Resources); links to Registrations & Services dates.               | - Real‑time conflict warnings<br>- Approval workflow stages<br>- Two‑way iCal feed                                                                |
| **Resources**                | Room & equipment catalog, setup requirements, prevents double booking. ([Planning Center][17])                                                                                              | Maintenance adds new projector resource → events reserve it via Calendar → analytics show utilization.                    | People permissions; Calendar events.                                                         | - Resource CRUD + categories<br>- Setup instructions stored<br>- Usage stats export                                                               |
| **Publishing**               | Themeable Church Center app/page builder; pages, audio/video, custom navigation. ([Planning Center][18], [Planning Center][2])                                                              | Admin edits page → previews in Church Center → publishes; congregant sees updated app instantly.                          | Pulls content links to Sermons (Services) & Events (Calendar).                               | - Live preview & version history<br>- Media transcoding & CDN<br>- Brand theme variables (colors, fonts)                                          |
| **Metrics / Reports**        | Engagement dashboard, cross‑module analytics, custom reports export. ([Planning Center][19])                                                                                                | Exec views dashboard → filters by campus → exports donor & attendance trends.                                             | Aggregates data from People, Giving, Groups, Check‑Ins.                                      | - Near‑real‑time refresh (<1 h)<br>- Save/share report configs<br>- CSV/PDF export                                                                |

---

## 3  Technical Blueprint (Inferred)

### 3.1  Canonical Data Models (YAML‑style; trim / extend as needed)

```yaml
# People ‑ Core
Person:
  id: UUID
  first_name: str
  last_name: str
  household_id: UUID
  campus_id: UUID
  contact:
    emails: list[Email]
    phones: list[Phone]
  membership_status: enum[guest|regular|member]
  custom_fields: dict[str, Any]
  tags: list[str]
  created_at: datetime
  updated_at: datetime

# Giving
Donation:
  id: UUID
  person_id: UUID
  fund_id: UUID
  amount_cents: int
  currency: str
  payment_method: enum[card|ach|cash|check]
  batch_id: UUID
  received_at: datetime

Fund:
  id: UUID
  name: str
  is_active: bool

# Check‑Ins
CheckIn:
  id: UUID
  person_id: UUID
  event_id: UUID
  location_id: UUID
  security_code: str
  checked_in_at: datetime
  checked_out_at: datetime|null

# Registrations
Signup:
  id: UUID
  person_id: UUID
  event_id: UUID
  selections: list[Selection]
  payment_id: UUID
  status: enum[confirmed|waitlisted|cancelled]
```

*(Omitted for brevity: Group, ServicePlan, CalendarEvent, Resource, Page, Metric, etc.)*

### 3.2  API & Integration Points

| Purpose             | Endpoint pattern (JSON‑API)                                                              | Notes                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **List people**     | `GET /people/v2/people?filter=name`                                                      | Paginates 25/pg; include `?include=emails,phone_numbers` to sparse‑field. ([support.planningcenteronline.com][20]) |
| **Create donation** | `POST /giving/v2/donations`                                                              | Requires developer token; amount in cents. ([GitHub][21])                                                          |
| **Webhooks**        | `/webhooks/{resource}`                                                                   | Available for Donations, People updates, Check‑Ins events.                                                         |
| **Auth**            | OAuth2 Confidential (server‑side) *or* Personal Access Token for server‑to‑server tasks. |                                                                                                                    |

### 3.3  Assumed Tech Stack & Patterns

| Layer     | Likely Choice                                                                         | Rationale                                |
| --------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| Front‑end | React (Church Center, Admin), React Native for mobile apps                            | SPA behavior & JS bundle hints from site |
| Back‑end  | Ruby on Rails monolith → service‑oriented; JSON‑API gem                               | Historic blog posts & JSON‑API adherence |
| DB        | PostgreSQL (UUID primary keys, JSONB for custom fields)                               | Convention for Rails & complex schemas   |
| Realtime  | Pusher / ActionCable for schedule & attendance updates                                |                                          |
| Payments  | Stripe (server‑side + client tokens) ([Planning Center][9])                           |                                          |
| SMS       | Twilio toll‑free SMS ([Planning Center][6])                                           |                                          |
| Infra     | AWS (S3 media, RDS Postgres, CloudFront) – inferred standard SaaS                     |                                          |
| Patterns  | Event‑driven (webhooks), CQRS for Metrics snapshots, background jobs (Sidekiq/Resque) |                                          |

### 3.4  Security & Compliance Highlights

* PCI DSS + Stripe tokenization for Giving.
* GDPR / CCPA personal‑data export‑delete (“Right to be forgotten”).
* COPPA/child‑safety: secure Check‑Out codes, background‑check status on volunteers (stored in People custom fields).
* TLS 1.2+, OAuth2 scopes per module, role‑based permissions.

---

## 4  Implementation Blueprint (Actionable Tasks)

> *Focus on additive dev; adjust granularity as needed for your repo.*

### 4.1  Cross‑Cutting Foundations

1. **Normalize Person IDs** across all local modules → migrate or alias existing IDs.
2. Implement **JSON‑API base layer** (serializer, pagination, sparse‑fieldsets).
3. **OAuth2 server** issuing scoped tokens for internal & third‑party apps.
4. **Webhook dispatcher** → message queue (e.g., RabbitMQ) → internal events.
5. **Custom Field Engine** – per‑entity dynamic schema saved in JSONB.

### 4.2  Module Tasks (excerpted)

| Module                   | Key Dev Tasks                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **People**               | • CRUD endpoints + bulk import CSV<br>• Custom‑field UI builder<br>• Form builder → workflow triggers<br>• Bulk SMS via Twilio SDK                           |
| **Giving**               | • Stripe integration (card + ACH)<br>• Batch entry UI + import tool<br>• Fund hierarchy & multi‑currency<br>• Year‑end PDF receipts generator                |
| **Check‑Ins**            | • Station app (Electron / PWA) with barcode & label printing<br>• Guardian code algorithm & validation middleware<br>• Attendance API & real‑time dashboards |
| **Registrations**        | • Event & price‑option models<br>• Capacity & wait‑list logic<br>• Partial payments schedule<br>• Roster export & QR check‑in link                           |
| **Groups**               | • Directory search & filters<br>• Leader self‑service portal<br>• Attendance form → Metrics pipeline                                                         |
| **Services**             | • Plan builder drag‑drop (Slate.js)<br>• Volunteer scheduler w/ conflict detection<br>• Song catalog & chord‑chart PDF merge                                 |
| **Calendar / Resources** | • Room/resource inventory<br>• Conflict‑resolution engine (interval trees)<br>• Approval workflow UI                                                         |
| **Publishing**           | • Theme variables (CSS‑in‑JS)<br>• WYSIWYG page builder w/ blocks<br>• Media transcoding pipeline (FFmpeg on S3)                                             |
| **Metrics**              | • ETL jobs (nightly snapshots)<br>• Widget DSL (SQL view + chart config)<br>• Role‑based dashboard sharing                                                   |

*(Full task list provided separately if required.)*

### 4.3  Known Gotchas & Library Quirks

* **JSON‑API pagination** returns `links.{next,prev}` – many client libs ignore this; patch your HTTP client.
* **Stripe ACH** has 4‑day settlement delay → reconcile batches asynchronously.
* **QRCode label printing** on Check‑In stations often fails on Windows printers lacking proper ESC‑POS drivers; ship network‑print fallback.
* **Custom fields** can bloat query joins; use JSONB & generated columns for indexing.

---

## 5  Validation & Confidence

| Tier                      | Check                                                                                        | Result                 |
| ------------------------- | -------------------------------------------------------------------------------------------- | ---------------------- |
| **Completeness**          | All requested sections (overview, modules, tech, tasks) included.                            | ✓                      |
| **Technical Feasibility** | Data models & stack align with JSON‑API + Stripe + Twilio patterns widely used in ChMS SaaS. | ✓ (assumptions marked) |
| **Consistency**           | Features listed match official PC marketing/help sources.                                    | ✓                      |

**Confidence Score:** **8 / 10**
*Remaining uncertainties:* internal codebase language choice (Rails vs. Elixir), exact Metrics schema, and whether Registrations & Resources have public API endpoints yet (PC road‑map suggests “planned”).

[1]: https://www.planningcenter.com/?utm_source=chatgpt.com "Planning Center: Church Management Software"
[2]: https://www.planningcenter.com/church-center?utm_source=chatgpt.com "Church Center Mobile App for Planning Center"
[3]: https://www.planningcenter.com/check-ins?utm_source=chatgpt.com "Planning Center Check-Ins: Child & Volunteer Attendance"
[4]: https://www.planningcenter.com/developers?utm_source=chatgpt.com "Planning Center for Developers"
[5]: https://rollout.com/integration-guides/planning-center/api-essentials?utm_source=chatgpt.com "Planning Center API Essential Guide - Rollout"
[6]: https://www.planningcenter.com/people?utm_source=chatgpt.com "Planning Center People: Membership Management"
[7]: https://pcopeople.zendesk.com/hc/en-us/articles/204263134-Customize-fields?utm_source=chatgpt.com "Customize fields - People - Zendesk"
[8]: https://www.planningcenter.com/blog/2025/02/5-new-features-you-may-have-missed-in-people?utm_source=chatgpt.com "5 new features you may have missed in People - Planning Center"
[9]: https://www.planningcenter.com/giving?utm_source=chatgpt.com "Easy Online Giving for Churches - Planning Center"
[10]: https://www.planningcenter.com/check-ins/download/android?utm_source=chatgpt.com "Planning Center Check-Ins windows App"
[11]: https://www.youtube.com/watch?v=cL99HgHczjI&utm_source=chatgpt.com "PCU: Planning Center Registrations - YouTube"
[12]: https://www.youtube.com/watch?v=4IZlNDTcxNo&utm_source=chatgpt.com "Planning Center Registrations: Selection Types - YouTube"
[13]: https://www.planningcenter.com/groups?utm_source=chatgpt.com "Organize groups, communicate with members - Planning Center"
[14]: https://www.planningcenter.com/services?utm_source=chatgpt.com "Planning Center Services: Worship Planning Software"
[15]: https://www.planningcenter.com/calendar?utm_source=chatgpt.com "Planning Center Calendar: Event & Facility Scheduling"
[16]: https://www.planningcenter.com/blog/2023/08/centralize-event-planning-from-a-single-calendar?utm_source=chatgpt.com "Bring all your event details together with new Calendar connections"
[17]: https://www.planningcenter.com/blog/2013/07/introducing-planning-center-resources?utm_source=chatgpt.com "Introducing: Planning Center Resources"
[18]: https://www.planningcenter.com/publishing?utm_source=chatgpt.com "Planning Center Publishing: Custom Web & App Content"
[19]: https://www.planningcenter.com/use-cases/chms?utm_source=chatgpt.com "Planning Center as a Church Management System"
[20]: https://support.planningcenteronline.com/hc/en-us/articles/4694905331867-The-Planning-Center-API?utm_source=chatgpt.com "The Planning Center API"
[21]: https://github.com/planningcenter/developers/blob/master/guides/giving_donations_integration.md?utm_source=chatgpt.com "developers/guides/giving_donations_integration.md at main - GitHub"
