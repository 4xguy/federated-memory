# Metadata Schemas

This document provides detailed metadata schemas for common entity types in the Federated Memory System. All entities are stored as memories with these metadata structures.

## Table of Contents
1. [Schema Conventions](#schema-conventions)
2. [Project Management Schemas](#project-management-schemas)
3. [People & Organization Schemas](#people--organization-schemas)
4. [Communication Schemas](#communication-schemas)
5. [Event & Calendar Schemas](#event--calendar-schemas)
6. [Financial Schemas](#financial-schemas)
7. [Content & Media Schemas](#content--media-schemas)
8. [System & Registry Schemas](#system--registry-schemas)

## Schema Conventions

### Required Fields for All Entities

```typescript
interface BaseMetadata {
  type: string;         // Entity type identifier (required)
  id: string;           // Unique identifier (usually UUID)
  createdAt: string;    // ISO 8601 timestamp
  updatedAt: string;    // ISO 8601 timestamp
  version?: number;     // Schema version for migrations
  category?: string;    // User-defined category
  tags?: string[];      // Searchable tags
}
```

### Field Naming Conventions

- Use camelCase for field names
- Use ISO 8601 for dates: `2024-01-20T10:30:00Z`
- Use enums for status fields
- Prefix boolean fields with `is`, `has`, or `can`
- Use arrays for multi-value fields
- Use nested objects for grouped data

## Project Management Schemas

### Project

```typescript
interface ProjectMetadata extends BaseMetadata {
  type: 'project';
  
  // Core fields
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Dates
  startDate?: string;      // ISO 8601
  dueDate?: string;        // ISO 8601
  completedDate?: string;  // ISO 8601
  
  // People
  owner?: string;          // User ID or email
  team?: Array<{
    userId: string;
    role: string;
    joinedAt: string;
  }>;
  
  // Progress
  progress: number;        // 0-100
  milestones?: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: 'pending' | 'completed';
    completedDate?: string;
  }>;
  
  // Organization
  ministry?: string;       // For church context
  department?: string;     // For business context
  client?: string;
  
  // Budget
  budget?: {
    allocated: number;
    spent: number;
    currency: string;    // ISO 4217 code
  };
  
  // Custom fields
  customFields?: Record<string, any>;
}

// Example
const projectExample: ProjectMetadata = {
  type: 'project',
  id: 'proj-123',
  name: 'Website Redesign',
  description: 'Complete redesign of church website',
  status: 'active',
  priority: 'high',
  startDate: '2024-01-15T00:00:00Z',
  dueDate: '2024-03-31T00:00:00Z',
  owner: 'john@church.org',
  team: [
    {
      userId: 'user-456',
      role: 'designer',
      joinedAt: '2024-01-15T10:00:00Z'
    }
  ],
  progress: 35,
  ministry: 'Communications',
  budget: {
    allocated: 15000,
    spent: 5250,
    currency: 'USD'
  },
  createdAt: '2024-01-15T09:00:00Z',
  updatedAt: '2024-01-25T14:30:00Z',
  tags: ['website', 'priority', 'q1-2024']
};
```

### Task

```typescript
interface TaskMetadata extends BaseMetadata {
  type: 'task';
  
  // Core fields
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Relationships
  projectId?: string;
  parentTaskId?: string;   // For subtasks
  dependsOn?: string[];    // Task IDs this depends on
  blocks?: string[];       // Task IDs this blocks
  
  // Assignment
  assignee?: string;       // User ID or email
  assignedDate?: string;
  
  // Timing
  dueDate?: string;
  startDate?: string;
  completedDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  
  // Checklist
  checklist?: Array<{
    id: string;
    text: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: string;
  }>;
  
  // Attachments
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedBy: string;
    uploadedAt: string;
  }>;
  
  // Recurring
  recurringTaskId?: string;
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];  // 0-6, Sunday-Saturday
    dayOfMonth?: number;    // 1-31
    endDate?: string;
  };
  
  // Context
  ministry?: string;
  labels?: string[];
}
```

### Task Dependency

```typescript
interface TaskDependencyMetadata extends BaseMetadata {
  type: 'task_dependency';
  
  taskId: string;          // Dependent task
  dependsOnTaskId: string; // Task it depends on
  dependencyType: 'blocks' | 'depends_on' | 'related';
  
  // Optional fields
  description?: string;
  createdBy: string;
  isStrict: boolean;       // If true, blocks execution
}
```

## People & Organization Schemas

### Person

```typescript
interface PersonMetadata extends BaseMetadata {
  type: 'person';
  
  // Basic Info
  firstName: string;
  lastName: string;
  middleName?: string;
  nickname?: string;
  title?: string;          // Mr., Mrs., Dr., etc.
  suffix?: string;         // Jr., III, etc.
  
  // Demographics
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birthdate?: string;      // ISO 8601 date only
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  
  // Contact
  contact: {
    emails: Array<{
      type: 'personal' | 'work' | 'other';
      address: string;
      primary: boolean;
      verified: boolean;
    }>;
    phones: Array<{
      type: 'mobile' | 'home' | 'work' | 'other';
      number: string;
      primary: boolean;
      canText: boolean;
    }>;
    address?: {
      type: 'home' | 'work' | 'other';
      street1: string;
      street2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
    };
  };
  
  // Membership
  membershipStatus: 'guest' | 'regular' | 'member' | 'inactive';
  membershipDate?: string;
  householdId?: string;
  householdRole?: 'head' | 'spouse' | 'child' | 'other';
  campusId?: string;
  
  // Church-specific
  baptismDate?: string;
  baptismLocation?: string;
  salvationDate?: string;
  
  // Custom Fields (church context)
  customFields?: {
    spiritualGifts?: string[];
    ministryInterests?: string[];
    skills?: string[];
    occupation?: string;
    employer?: string;
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
    medicalNotes?: string;
    allergies?: string[];
    specialNeeds?: string;
  };
  
  // Privacy
  privacy?: {
    hideAddress: boolean;
    hidePhone: boolean;
    hideEmail: boolean;
    allowPhotography: boolean;
    allowDirectoryListing: boolean;
  };
  
  // System
  photoUrl?: string;
  lastActivityDate?: string;
  notes?: string;
}

// Example
const personExample: PersonMetadata = {
  type: 'person',
  id: 'person-789',
  firstName: 'Sarah',
  lastName: 'Johnson',
  gender: 'female',
  birthdate: '1985-04-15',
  contact: {
    emails: [
      {
        type: 'personal',
        address: 'sarah.johnson@email.com',
        primary: true,
        verified: true
      }
    ],
    phones: [
      {
        type: 'mobile',
        number: '+1-555-0123',
        primary: true,
        canText: true
      }
    ],
    address: {
      type: 'home',
      street1: '123 Main Street',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'USA'
    }
  },
  membershipStatus: 'member',
  membershipDate: '2019-06-01',
  householdId: 'household-456',
  householdRole: 'spouse',
  baptismDate: '2019-08-15',
  customFields: {
    spiritualGifts: ['teaching', 'hospitality'],
    ministryInterests: ['children', 'worship'],
    skills: ['graphic design', 'social media']
  },
  createdAt: '2019-06-01T10:00:00Z',
  updatedAt: '2024-01-20T15:30:00Z',
  category: 'Members',
  tags: ['volunteer', 'worship-team']
};
```

### Household

```typescript
interface HouseholdMetadata extends BaseMetadata {
  type: 'household';
  
  name: string;            // "The Johnson Family"
  formalName?: string;     // "Mr. and Mrs. Robert Johnson"
  informalName?: string;   // "Bob & Sarah"
  
  // Members
  members: Array<{
    personId: string;
    role: 'head' | 'spouse' | 'child' | 'other';
    isPrimary: boolean;
  }>;
  
  // Contact (shared household info)
  primaryContact?: string;  // Person ID
  address?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  
  // Preferences
  preferences?: {
    contactMethod: 'email' | 'phone' | 'mail';
    envelopeNumber?: string;
    anniversaryDate?: string;
  };
}
```

### Group

```typescript
interface GroupMetadata extends BaseMetadata {
  type: 'group';
  
  name: string;
  description?: string;
  groupType: 'small_group' | 'ministry_team' | 'class' | 'committee' | 'other';
  
  // Leadership
  leaders: Array<{
    personId: string;
    role: 'leader' | 'co-leader' | 'admin';
    startDate: string;
  }>;
  
  // Details
  meetingSchedule?: {
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    dayOfWeek?: number;     // 0-6
    time?: string;          // "19:00"
    duration?: number;      // minutes
    location?: string;
  };
  
  // Settings
  settings: {
    isPublic: boolean;
    allowSelfSignup: boolean;
    requireApproval: boolean;
    maxMembers?: number;
    minAge?: number;
    maxAge?: number;
    gender?: 'male' | 'female' | 'mixed';
  };
  
  // Organization
  ministry?: string;
  campus?: string;
  semester?: string;       // For classes
  
  // Status
  status: 'forming' | 'active' | 'inactive' | 'archived';
  startDate?: string;
  endDate?: string;
  
  // Resources
  resources?: Array<{
    id: string;
    title: string;
    type: 'document' | 'video' | 'link';
    url: string;
    addedBy: string;
    addedAt: string;
  }>;
}
```

### Group Membership

```typescript
interface GroupMembershipMetadata extends BaseMetadata {
  type: 'group_membership';
  
  personId: string;
  groupId: string;
  
  // Role
  role: 'member' | 'leader' | 'admin' | 'guest';
  
  // Dates
  joinedDate: string;
  leftDate?: string;
  
  // Participation
  attendance?: {
    lastAttended?: string;
    totalMeetings: number;
    attendedMeetings: number;
  };
  
  // Status
  status: 'active' | 'inactive' | 'pending';
  
  // Permissions
  permissions?: string[];
  
  // Notes
  notes?: string;
}
```

## Communication Schemas

### Communication

```typescript
interface CommunicationMetadata extends BaseMetadata {
  type: 'communication';
  
  // Basic Info
  subject: string;
  body: string;
  format: 'plain' | 'html' | 'markdown';
  communicationType: 'email' | 'sms' | 'push' | 'letter' | 'call';
  
  // Sender
  sender: {
    userId?: string;
    email?: string;
    name: string;
    replyTo?: string;
  };
  
  // Recipients
  recipients: {
    to: Array<{
      personId?: string;
      email?: string;
      name?: string;
      type: 'person' | 'group' | 'list';
    }>;
    cc?: Array<{
      personId?: string;
      email?: string;
      name?: string;
    }>;
    bcc?: Array<{
      personId?: string;
      email?: string;
      name?: string;
    }>;
  };
  
  // Status
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduledDate?: string;
  sentDate?: string;
  
  // Tracking
  stats?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  
  // Templates
  templateId?: string;
  templateVariables?: Record<string, any>;
  
  // Context
  relatedTo?: {
    type: 'event' | 'group' | 'campaign' | 'general';
    id: string;
  };
  
  // Settings
  settings?: {
    trackOpens: boolean;
    trackClicks: boolean;
    allowUnsubscribe: boolean;
  };
}
```

### Note

```typescript
interface NoteMetadata extends BaseMetadata {
  type: 'note';
  
  // Content
  title?: string;
  content: string;
  format: 'plain' | 'markdown' | 'html';
  
  // Association
  relatedTo: {
    type: 'person' | 'household' | 'group' | 'event' | 'project';
    id: string;
  };
  
  // Author
  authorId: string;
  authorName: string;
  
  // Visibility
  visibility: 'private' | 'team' | 'public';
  sharedWith?: string[];   // User IDs
  
  // Type
  noteType: 'general' | 'pastoral' | 'followup' | 'prayer' | 'medical';
  
  // Follow-up
  requiresFollowup: boolean;
  followupDate?: string;
  followupAssignee?: string;
  followupCompleted?: boolean;
  
  // Attachments
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>;
}
```

## Event & Calendar Schemas

### Event

```typescript
interface EventMetadata extends BaseMetadata {
  type: 'event';
  
  // Basic Info
  title: string;
  description?: string;
  eventType: 'service' | 'class' | 'meeting' | 'social' | 'outreach' | 'other';
  
  // Schedule
  schedule: {
    startDateTime: string;
    endDateTime: string;
    allDay: boolean;
    timezone: string;      // IANA timezone
  };
  
  // Recurrence
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval: number;
    daysOfWeek?: number[]; // For weekly
    dayOfMonth?: number;   // For monthly
    month?: number;        // For yearly
    count?: number;        // Number of occurrences
    until?: string;        // End date
    exceptions?: string[]; // Dates to skip
  };
  
  // Location
  location: {
    type: 'physical' | 'online' | 'hybrid';
    name?: string;
    address?: string;
    room?: string;
    capacity?: number;
    onlineUrl?: string;
    onlinePlatform?: 'zoom' | 'youtube' | 'facebook' | 'other';
  };
  
  // Organizer
  organizer: {
    personId?: string;
    name: string;
    email?: string;
    phone?: string;
  };
  
  // Registration
  registration?: {
    required: boolean;
    capacity?: number;
    deadline?: string;
    cost?: number;
    earlyBirdDeadline?: string;
    earlyBirdCost?: number;
  };
  
  // Categories
  ministry?: string;
  campus?: string;
  targetAudience?: string[];
  
  // Status
  status: 'draft' | 'published' | 'cancelled';
  visibility: 'public' | 'members' | 'private';
  
  // Resources
  resources?: Array<{
    id: string;
    type: 'room' | 'equipment' | 'vehicle' | 'staff';
    name: string;
    confirmed: boolean;
  }>;
}
```

### Registration

```typescript
interface RegistrationMetadata extends BaseMetadata {
  type: 'registration';
  
  // Event
  eventId: string;
  eventName: string;
  
  // Registrant
  registrant: {
    personId?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  
  // Details
  attendees: Array<{
    personId?: string;
    firstName: string;
    lastName: string;
    age?: number;
    dietaryRestrictions?: string;
    specialNeeds?: string;
  }>;
  
  // Status
  status: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled';
  
  // Payment
  payment?: {
    amount: number;
    method: 'card' | 'cash' | 'check' | 'scholarship';
    status: 'pending' | 'paid' | 'refunded';
    transactionId?: string;
    paidDate?: string;
  };
  
  // Responses
  formResponses?: Record<string, any>;
  
  // Notes
  specialRequests?: string;
  internalNotes?: string;
  
  // Confirmation
  confirmationNumber: string;
  confirmationSent: boolean;
  confirmationSentDate?: string;
}
```

### Attendance

```typescript
interface AttendanceMetadata extends BaseMetadata {
  type: 'attendance';
  
  // Event/Meeting
  eventId?: string;
  groupId?: string;
  serviceId?: string;
  date: string;
  
  // Person
  personId: string;
  personName: string;
  
  // Status
  status: 'present' | 'absent' | 'late' | 'excused';
  
  // Check-in
  checkInTime?: string;
  checkOutTime?: string;
  checkInMethod?: 'manual' | 'kiosk' | 'mobile' | 'scanner';
  
  // Details
  role?: 'attendee' | 'volunteer' | 'leader';
  location?: string;
  
  // For children
  securityCode?: string;
  pickedUpBy?: string;
  pickedUpTime?: string;
  
  // Notes
  notes?: string;
}
```

## Financial Schemas

### Donation

```typescript
interface DonationMetadata extends BaseMetadata {
  type: 'donation';
  
  // Donor
  donor: {
    personId?: string;
    householdId?: string;
    name: string;
    email?: string;
    isAnonymous: boolean;
  };
  
  // Amount
  amount: number;
  currency: string;         // ISO 4217
  
  // Method
  method: 'cash' | 'check' | 'card' | 'ach' | 'stock' | 'cryptocurrency' | 'other';
  checkNumber?: string;
  last4?: string;          // Last 4 of card
  
  // Designation
  fund: {
    id: string;
    name: string;
    isDeductible: boolean;
  };
  memo?: string;
  
  // Campaign
  campaignId?: string;
  pledgeId?: string;
  
  // Processing
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  processedDate?: string;
  batchId?: string;
  transactionId?: string;
  processorFee?: number;
  
  // Receipt
  receiptNumber?: string;
  receiptSent: boolean;
  receiptSentDate?: string;
  
  // Tax
  taxDeductible: boolean;
  acknowledgmentLetter?: boolean;
}
```

### Pledge

```typescript
interface PledgeMetadata extends BaseMetadata {
  type: 'pledge';
  
  // Pledger
  pledger: {
    personId?: string;
    householdId?: string;
    name: string;
  };
  
  // Campaign
  campaignId: string;
  campaignName: string;
  
  // Amount
  totalAmount: number;
  currency: string;
  
  // Schedule
  frequency: 'one-time' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  startDate: string;
  endDate?: string;
  numberOfPayments?: number;
  
  // Progress
  amountPaid: number;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  
  // Status
  status: 'active' | 'completed' | 'cancelled' | 'defaulted';
  
  // Notes
  notes?: string;
}
```

## Content & Media Schemas

### Media

```typescript
interface MediaMetadata extends BaseMetadata {
  type: 'media';
  
  // Basic Info
  title: string;
  description?: string;
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'presentation';
  
  // File Info
  file: {
    url: string;
    name: string;
    size: number;         // bytes
    mimeType: string;
    duration?: number;    // seconds for video/audio
    dimensions?: {
      width: number;
      height: number;
    };
  };
  
  // Versions
  versions?: Array<{
    name: string;         // 'thumbnail', 'preview', 'hd', etc.
    url: string;
    size: number;
    dimensions?: {
      width: number;
      height: number;
    };
  }>;
  
  // Context
  usedIn?: Array<{
    type: 'sermon' | 'event' | 'article' | 'email';
    id: string;
    name: string;
  }>;
  
  // Rights
  copyright?: string;
  license?: string;
  attribution?: string;
  
  // Organization
  ministry?: string;
  speaker?: string;       // For sermons
  series?: string;        // For sermon series
  
  // Access
  visibility: 'public' | 'members' | 'private';
  downloadable: boolean;
}
```

### Article

```typescript
interface ArticleMetadata extends BaseMetadata {
  type: 'article';
  
  // Content
  title: string;
  slug: string;           // URL-friendly version
  excerpt?: string;
  content: string;
  format: 'markdown' | 'html' | 'plain';
  
  // Author
  author: {
    personId?: string;
    name: string;
    bio?: string;
    photoUrl?: string;
  };
  
  // Publishing
  status: 'draft' | 'review' | 'scheduled' | 'published';
  publishDate?: string;
  expiryDate?: string;
  
  // Media
  featuredImage?: {
    url: string;
    caption?: string;
    credits?: string;
  };
  
  // Organization
  categories: string[];
  ministry?: string;
  
  // SEO
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    canonicalUrl?: string;
  };
  
  // Engagement
  stats?: {
    views: number;
    shares: number;
    reactions?: Record<string, number>;
  };
}
```

## System & Registry Schemas

### Registry

```typescript
interface RegistryMetadata extends BaseMetadata {
  type: 'registry';
  
  registryType: string;    // 'categories', 'tags', 'ministries', etc.
  name: string;
  description?: string;
  
  // Items in the registry
  items: Array<{
    id?: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    parentId?: string;     // For hierarchical registries
    sortOrder?: number;
    isActive?: boolean;
    metadata?: Record<string, any>;
  }>;
  
  // Settings
  settings?: {
    allowUserCreation: boolean;
    requireApproval: boolean;
    maxDepth?: number;     // For hierarchical
    enforceUniqueness: boolean;
  };
  
  // Metadata
  version: number;
  lastUpdatedBy: string;
}

// Example: Category Registry
const categoryRegistry: RegistryMetadata = {
  type: 'registry',
  registryType: 'categories',
  id: 'registry-categories',
  name: 'System Categories',
  description: 'Master list of all categories',
  items: [
    {
      name: 'Members',
      description: 'Church members',
      icon: '👥',
      color: '#4A90E2',
      sortOrder: 1,
      isActive: true
    },
    {
      name: 'Staff',
      description: 'Church staff and employees',
      icon: '💼',
      color: '#7ED321',
      sortOrder: 2,
      isActive: true,
      metadata: {
        requiresBackgroundCheck: true
      }
    }
  ],
  settings: {
    allowUserCreation: false,
    requireApproval: true,
    enforceUniqueness: true
  },
  version: 1,
  lastUpdatedBy: 'system',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-20T10:00:00Z'
};
```

### Audit Log

```typescript
interface AuditLogMetadata extends BaseMetadata {
  type: 'audit_log';
  
  // Action
  action: 'create' | 'update' | 'delete' | 'view' | 'export' | 'login' | 'logout';
  entityType: string;      // What was acted upon
  entityId: string;
  
  // Actor
  actor: {
    userId: string;
    name: string;
    ipAddress?: string;
    userAgent?: string;
  };
  
  // Changes
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields?: string[];     // Which fields changed
  };
  
  // Context
  context?: {
    reason?: string;
    authorizedBy?: string;
    sessionId?: string;
    apiKeyId?: string;
  };
  
  // Result
  result: 'success' | 'failure' | 'partial';
  error?: string;
}
```

### Configuration

```typescript
interface ConfigurationMetadata extends BaseMetadata {
  type: 'configuration';
  
  configType: string;      // 'system', 'module', 'user'
  scope: string;           // 'global', 'ministry', 'campus', 'user'
  
  // Settings
  settings: Record<string, any>;
  
  // Schema
  schema?: {
    properties: Record<string, any>;  // JSON Schema
    required?: string[];
  };
  
  // Metadata
  version: number;
  isDefault: boolean;
  isLocked: boolean;       // Prevents modification
  
  // Inheritance
  inheritsFrom?: string;   // Parent config ID
  overrides?: string[];    // Which settings override parent
}
```

## Schema Evolution

### Versioning Strategy

```typescript
interface VersionedMetadata extends BaseMetadata {
  schemaVersion: number;   // Current schema version
  
  // Migration history
  migrations?: Array<{
    fromVersion: number;
    toVersion: number;
    migratedAt: string;
    migratedBy: string;
  }>;
}
```

### Migration Example

```typescript
// Migration function for person schema v1 to v2
function migratePersonV1ToV2(oldMetadata: any): PersonMetadata {
  return {
    ...oldMetadata,
    schemaVersion: 2,
    // Split old 'name' field
    firstName: oldMetadata.name?.split(' ')[0] || '',
    lastName: oldMetadata.name?.split(' ').slice(1).join(' ') || '',
    // Move phone to new structure
    contact: {
      ...oldMetadata.contact,
      phones: oldMetadata.phone ? [{
        type: 'mobile',
        number: oldMetadata.phone,
        primary: true,
        canText: true
      }] : []
    }
  };
}
```

## Best Practices

1. **Always include type field** - Critical for querying
2. **Use ISO 8601 for dates** - Ensures consistency
3. **Prefer enums over strings** - For status and type fields
4. **Include audit fields** - createdAt, updatedAt, version
5. **Design for extensibility** - Use customFields for flexibility
6. **Normalize references** - Store IDs, not embedded objects
7. **Consider privacy** - Separate sensitive data
8. **Plan for growth** - Design schemas that can evolve
9. **Document assumptions** - Explain business rules in comments
10. **Test with real data** - Validate schemas with actual use cases