/**
 * Type definitions for Church Management System
 * Following Planning Center patterns with federated-memory UMC architecture
 */

// ============= Core Person Types =============

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  nickname?: string;
  title?: string;  // Mr., Mrs., Dr., etc.
  suffix?: string; // Jr., III, etc.
  
  // Demographics
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birthdate?: string; // ISO 8601 date
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  
  // Contact
  contact: ContactInfo;
  
  // Membership
  membershipStatus: MembershipStatus;
  membershipDate?: string;
  householdId?: string;
  householdRole?: HouseholdRole;
  campusId?: string;
  
  // Church-specific
  baptismDate?: string;
  baptismLocation?: string;
  salvationDate?: string;
  
  // Custom Fields
  customFields?: CustomFieldValues;
  
  // Organization
  tags: string[];
  category?: string;
  
  // Privacy
  privacy?: PrivacySettings;
  
  // System
  photoUrl?: string;
  lastActivityDate?: string;
  notes?: string;
}

export interface ContactInfo {
  emails: EmailContact[];
  phones: PhoneContact[];
  address?: Address;
}

export interface EmailContact {
  type: 'personal' | 'work' | 'other';
  address: string;
  primary: boolean;
  verified?: boolean;
}

export interface PhoneContact {
  type: 'mobile' | 'home' | 'work' | 'other';
  number: string;
  primary: boolean;
  canText?: boolean;
}

export interface Address {
  type?: 'home' | 'work' | 'other';
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export enum MembershipStatus {
  GUEST = 'guest',
  REGULAR = 'regular',
  MEMBER = 'member',
  INACTIVE = 'inactive'
}

export enum HouseholdRole {
  HEAD = 'head',
  SPOUSE = 'spouse',
  CHILD = 'child',
  OTHER = 'other'
}

export interface CustomFieldValues {
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
  [key: string]: any; // Allow dynamic custom fields
}

export interface PrivacySettings {
  hideAddress?: boolean;
  hidePhone?: boolean;
  hideEmail?: boolean;
  allowPhotography?: boolean;
  allowDirectoryListing?: boolean;
}

// ============= Household Types =============

export interface Household {
  id: string;
  name: string;           // "The Johnson Family"
  formalName?: string;    // "Mr. and Mrs. Robert Johnson"
  informalName?: string;  // "Bob & Sarah"
  
  // Members
  members: HouseholdMember[];
  primaryContactId?: string;
  
  // Contact (shared household info)
  address?: Address;
  homePhone?: string;
  
  // Preferences
  preferences?: HouseholdPreferences;
  
  // System
  campusId?: string;
  category?: string;
  tags?: string[];
}

export interface HouseholdMember {
  personId: string;
  role: HouseholdRole;
  isPrimary: boolean;
}

export interface HouseholdPreferences {
  contactMethod?: 'email' | 'phone' | 'mail';
  envelopeNumber?: string;
  anniversaryDate?: string;
}

// ============= Ministry & Groups =============

export interface MinistryRole {
  id: string;
  personId: string;
  ministryName: string;
  role: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  responsibilities?: string[];
}

export interface GroupMembership {
  id: string;
  personId: string;
  groupId: string;
  groupName: string;
  role: 'member' | 'leader' | 'admin' | 'guest';
  joinedDate: string;
  leftDate?: string;
  status: 'active' | 'inactive' | 'pending';
  attendance?: AttendanceStats;
}

// ============= Custom Fields =============

export interface CustomFieldDefinition {
  id: string;
  name: string;
  fieldKey: string; // Unique identifier for the field
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  options?: string[]; // For select/multiselect
  required?: boolean;
  category?: string; // Group related fields
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  visibility?: 'public' | 'leaders' | 'admin';
}

// ============= Lists & Filters =============

export interface PeopleList {
  id: string;
  name: string;
  description?: string;
  filters: PeopleFilters;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  memberCount?: number;
}

export interface PeopleFilters {
  membershipStatus?: MembershipStatus[];
  tags?: string[];
  ministries?: string[];
  campuses?: string[];
  ageRange?: {
    min?: number;
    max?: number;
  };
  gender?: string[];
  hasEmail?: boolean;
  hasPhone?: boolean;
  customFields?: Record<string, any>;
  createdAfter?: string;
  createdBefore?: string;
  lastActivityAfter?: string;
  lastActivityBefore?: string;
}

// ============= Attendance =============

export interface Attendance {
  id: string;
  personId: string;
  eventType: 'service' | 'group' | 'class' | 'event';
  eventId?: string;
  eventName: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime?: string;
  checkOutTime?: string;
  checkInMethod?: 'manual' | 'kiosk' | 'mobile' | 'scanner';
  location?: string;
  notes?: string;
  
  // For children
  securityCode?: string;
  pickedUpBy?: string;
  pickedUpTime?: string;
}

export interface AttendanceStats {
  lastAttended?: string;
  totalMeetings: number;
  attendedMeetings: number;
  attendanceRate: number; // Percentage
}

// ============= Bulk Operations =============

export interface BulkOperation {
  operation: 'update' | 'delete' | 'tag' | 'untag' | 'assign';
  targetIds: string[];
  updates?: Partial<Person>;
  tags?: string[];
  ministry?: string;
  customFields?: Record<string, any>;
}

export interface BulkOperationResult {
  successful: string[];
  failed: Array<{
    id: string;
    reason: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

// ============= Export/Import =============

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  fields?: string[];
  includeCustomFields?: boolean;
  includeHouseholds?: boolean;
  includeMinistries?: boolean;
  filters?: PeopleFilters;
}

export interface ImportMapping {
  sourceField: string;
  targetField: string;
  transform?: 'lowercase' | 'uppercase' | 'date' | 'phone';
}

export interface ImportOptions {
  updateExisting?: boolean;
  skipDuplicates?: boolean;
  matchBy?: 'email' | 'name' | 'phone';
  mappings?: ImportMapping[];
  defaultValues?: Partial<Person>;
}

// ============= Search Types =============

export interface PersonSearchParams {
  query?: string; // Natural language or name search
  filters?: PeopleFilters;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastActivity';
  sortOrder?: 'asc' | 'desc';
}

export interface PersonSearchResult {
  person: Person;
  score?: number; // Relevance score for semantic search
  matchedFields?: string[]; // Which fields matched the search
}

// ============= Registry Types =============

export interface MinistryRegistry {
  ministries: Ministry[];
  lastUpdated: string;
  version: number;
}

export interface Ministry {
  name: string;
  description?: string;
  leader?: string;
  icon?: string;
  color?: string;
  parentMinistry?: string;
  isActive: boolean;
  sortOrder?: number;
}

export interface TagRegistry {
  tags: Tag[];
  lastUpdated: string;
  version: number;
}

export interface Tag {
  name: string;
  category?: string;
  color?: string;
  description?: string;
  usageCount?: number;
}

export interface CampusRegistry {
  campuses: Campus[];
  lastUpdated: string;
  version: number;
}

export interface Campus {
  id: string;
  name: string;
  address?: Address;
  pastor?: string;
  servicesTimes?: string[];
  timezone?: string;
  isActive: boolean;
}

// ============= Response Types =============

export interface PersonResponse {
  success: boolean;
  person?: Person;
  error?: string;
  message?: string;
}

export interface PeopleListResponse {
  results: Person[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface RegistryResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============= Utility Types =============

export type PartialPerson = Partial<Omit<Person, 'id' | 'membershipStatus'>> & {
  membershipStatus?: MembershipStatus;
};

export type PersonUpdate = Partial<Omit<Person, 'id'>>;

export type PersonMetadata = Person & {
  type: 'person';
  createdAt: string;
  updatedAt: string;
  version?: number;
};

export type HouseholdMetadata = Household & {
  type: 'household';
  createdAt: string;
  updatedAt: string;
  version?: number;
};