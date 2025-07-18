# Planning Center Context Engineering Document

## Overall Product Overview & Context

### Product Purpose
Planning Center is a modular church management SAAS platform designed to streamline administrative tasks, foster community engagement, and support ministry operations. At its core is the "People" module, serving as a centralized database for member profiles, which integrates with all other modules to ensure data consistency and avoid silos.

### Business Value
It solves key church challenges like volunteer coordination, event planning, donation tracking, and attendance management, delivering value through efficiency, secure data handling, real-time collaboration, and scalable tools that adapt to church size. This reduces administrative burden, enhances engagement, and supports growth while maintaining data privacy for sensitive information.

## Module-Specific Breakdown

### People Module
- **Core Functionality**: Central database for managing member profiles, households, custom fields (e.g., baptism dates, spiritual gifts), automations for updates/emails, workflows for follow-up, and dashboards for engagement metrics like attendance trends.
- **Key User Flows**: Import CSV data → Create/edit profiles → Set automations (e.g., welcome emails) → Run lists/queries → Export reports → Merge duplicates.
- **Inter-Module Dependencies**: Hub for all modules; provides profiles to Services (volunteers), Giving (donors), Check-Ins (attendees), Registrations (signups), Groups (members), Calendar (event owners), ensuring unified data.
- **Inferred Acceptance Criteria**: Profiles accurately imported without duplicates; automations trigger correctly; lists generate expected results; data syncs across modules without loss.

### Services Module
- **Core Functionality**: Worship planning (songs, set lists, rehearsals), volunteer scheduling (preferences, blockouts), plan templates, file attachments, CCLI reporting, real-time chat during services.
- **Key User Flows**: Create service type → Build plan/order → Schedule volunteers → Attach media → Rehearse/transpose → Track attendance.
- **Inter-Module Dependencies**: Pulls people from People module for scheduling; integrates with Calendar for event timing; links to Groups for team coordination.
- **Inferred Acceptance Criteria**: Plans reusable via templates; volunteers scheduled without conflicts; media imports correctly; reports accurate.

### Giving Module
- **Core Functionality**: Online donations (cards, ACH), pledge campaigns, fund designation, batch processing, statements, dashboards for trends, manual entry for cash/checks.
- **Key User Flows**: Set up funds → Process donation → Track pledges → Generate statements → Export to accounting software.
- **Inter-Module Dependencies**: Links donors to People profiles; integrates with Registrations for event payments; syncs with Calendar for campaign events.
- **Inferred Acceptance Criteria**: Donations processed securely; funds allocated correctly; statements match records; no duplicate entries.

### Check-Ins Module
- **Core Functionality**: Secure check-in/out for kids/volunteers, label printing, attendance tracking, headcounts, real-time updates, alerts for forms/payments.
- **Key User Flows**: Set up stations (manned/self/roster) → Check in household → Print labels → Track attendance → Generate reports.
- **Inter-Module Dependencies**: Uses People for profiles/households; integrates with Registrations for event check-ins; links to Services for volunteer tracking.
- **Inferred Acceptance Criteria**: Check-ins fast/secure; reports accurate; integrates with printers without errors.

### Registrations Module
- **Core Functionality**: Event signups, payments, forms/questions, assignments (groups/cabins), waitlists, cancellations, attendance tracking.
- **Key User Flows**: Create event/signup → Collect info/payments → Assign attendees → Send reminders → Check in attendees.
- **Inter-Module Dependencies**: Pulls registrants from People; links to Calendar for scheduling; integrates with Check-Ins for attendance; uses Giving for payments.
- **Inferred Acceptance Criteria**: Signups capture all data; payments processed; assignments automated; cancellations handled smoothly.

### Groups Module
- **Core Functionality**: Group creation (small groups, recovery), signups, messaging/chat, event calendars, attendance tracking, resources sharing.
- **Key User Flows**: Create group type → Add members → Schedule events → Take attendance → Facilitate chat → Track engagement.
- **Inter-Module Dependencies**: Members from People; events sync with Calendar; integrates with Registrations for signups.
- **Inferred Acceptance Criteria**: Groups private/public as set; attendance logged; chat secure; metrics show engagement.

### Calendar Module (Including Resources)
- **Core Functionality**: Event scheduling, room/resource reservations, conflict checks, request forms, iCal syncs, kiosks for display.
- **Key User Flows**: Create event → Reserve room/resource → Approve requests → Publish to app/website → Sync calendars.
- **Inter-Module Dependencies**: Events link to Services/Registrations/Groups; resources tied to People for owners; central for all modules' scheduling.
- **Inferred Acceptance Criteria**: No conflicts; events published accurately; syncs reliable.

### Publishing Module
- **Core Functionality**: Custom web/app content creation (pages, themes, sermons, broadcasts), drag-and-drop blocks, event schedules.
- **Key User Flows**: Build pages → Add content/blocks → Publish to Church Center app → Broadcast sermons.
- **Inter-Module Dependencies**: Integrates with Calendar for events; People for access; Services for sermon notes.
- **Inferred Acceptance Criteria**: Content displays correctly; broadcasts stream without issues.

## Technical Insights

### Inferred Data Models
Presented in YAML-like schema for efficiency:

```yaml
People:
  Person:
    attributes:
      id: integer
      first_name: string
      last_name: string
      email: string
      phone: string
      birthdate: date
      gender: enum [male, female, other]
      custom_fields: dict [e.g., baptism_date: date, spiritual_gifts: array[string]]
    relationships:
      household: has_one [Household]
      groups: has_many [GroupMember]
      donations: has_many [Donation]

Giving:
  Donation:
    attributes:
      id: integer
      amount: decimal
      date: date
      method: enum [card, ach, cash, check]
      fund: string
      status: enum [processed, refunded]
    relationships:
      donor: belongs_to [Person]
      batch: belongs_to [Batch]

Services:
  Plan:
    attributes:
      id: integer
      date: date
      service_type: string
      items: array [Item {type: string, duration: integer, files: array[string]}]
    relationships:
      volunteers: has_many [Person]
      songs: has_many [Song {title: string, key: string}]

Check-Ins:
  CheckIn:
    attributes:
      id: integer
      time: datetime
      location: string
    relationships:
      person: belongs_to [Person]
      event: belongs_to [Event]

Registrations:
  Registration:
    attributes:
      id: integer
      event_id: integer
      attendees: integer
      payment_status: enum [paid, pending]
    relationships:
      registrant: belongs_to [Person]
      forms: has_many [FormResponse]

Groups:
  Group:
    attributes:
      id: integer
      name: string
      type: string
      privacy: enum [public, private]
    relationships:
      members: has_many [Person]
      events: has_many [Event]

Calendar:
  Event:
    attributes:
      id: integer
      title: string
      start: datetime
      end: datetime
      description: string
    relationships:
      rooms: has_many [Room {name: string}]
      resources: has_many [Resource {name: string}]
```

### Inferred APIs/Integration Points
- RESTful API at `https://api.planningcenteronline.com` (JSON-API spec).
- Endpoints: /people/v2, /giving/v2, /services/v2, etc.
- Authentication: OAuth2 or Personal Access Tokens.
- Webhooks for real-time updates (e.g., new donations, person changes).
- Integrations: Shared DB via People; message queues for async updates; exports to CSV/ICAL.

### Assumed Tech Stack & Patterns
- Cloud: AWS/Azure (scalable SAAS).
- DB: PostgreSQL/MySQL (relational for entities like People/Donations).
- Languages: Ruby on Rails (inferred from gems/docs).
- Frontend: React/Vue (JS-heavy sites).
- Patterns: Microservices per module; MVC; event-driven (webhooks); REST with JSON-API.

### Security/Compliance Considerations
- Two-step verification; role-based permissions.
- GDPR/CCPA compliance for personal data; PCI-DSS for payments via Stripe.
- Sensitive data encryption; audit logs; anonymous groups for recovery/support.

## Actionable Development Tasks

### General Tasks for All Modules (Brownfield Adaptation)
1. Audit existing local codebase for compatibility with inferred models (e.g., map local Person to Planning Center Person attributes).
2. Implement API wrappers for authentication (OAuth2) and basic CRUD on People endpoints.
3. Add data migration scripts to sync local DB with Planning Center via CSV imports/exports.
4. Handle "gotchas": Rate limits (poll sparingly); webhook retries for failures; versioned APIs (use v2).

### People Module Tasks
1. Fetch Person data via API and map to local models.
2. Implement sync for custom fields and households.
3. Add automation triggers (e.g., email on profile update).
4. Test duplicate merging and list generation.

### Services Module Tasks
1. Integrate volunteer scheduling with local calendars.
2. Sync plans and attachments; handle song transpositions.
3. Automate CCLI reporting exports.
4. Add real-time chat via websockets if not present.

### Giving Module Tasks
1. Set up webhook for new donations; sync to local ledger.
2. Implement fund allocation and statement generation.
3. Handle refunds/failures with retries.
4. Integrate with Stripe for payments.

### Check-Ins Module Tasks
1. Build station interfaces (manned/self) with label printing.
2. Sync attendance to People profiles.
3. Add alerts for incomplete forms.
4. Test headcount mode for quick tracking.

### Registrations Module Tasks
1. Create event signup forms with payment integration.
2. Automate assignments and waitlists.
3. Sync with Check-Ins for attendance.
4. Handle cancellations and refunds.

### Groups Module Tasks
1. Sync group members from People.
2. Implement chat and event calendars.
3. Track attendance and engagement metrics.
4. Ensure privacy for sensitive groups.

### Calendar Module Tasks
1. Sync events/resources with iCal feeds.
2. Implement conflict checks and approvals.
3. Embed in local app/website.
4. Connect to other modules for holistic views.

## Validation & Confidence
- **Completeness Checks**: All sections covered; inferred modules based on official lists.
- **Technical Feasibility Assessments**: Inferred stack aligns with SAAS norms; APIs support described integrations.
- **Requirement Consistency Verification**: Details match product functionalities from docs/reviews.
- **Confidence Score**: 9/10. High due to official sources; uncertainty in exact tech stack (assumed) and some module overlaps (e.g., Resources in Calendar). Limited public API model details required inference from snippets.