export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TEACHER = 'TEACHER',
  STAFF = 'STAFF',
}

export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
}
