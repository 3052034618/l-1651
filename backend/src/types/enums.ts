export const UserRole = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  STAFF: 'STAFF',
  HOST: 'HOST',
  CREMATOR: 'CREMATOR',
  RECEPTION: 'RECEPTION',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type Gender = typeof Gender[keyof typeof Gender];

export const RemainsStatus = {
  REGISTERED: 'REGISTERED',
  IN_STORAGE: 'IN_STORAGE',
  CEREMONY_SCHEDULED: 'CEREMONY_SCHEDULED',
  IN_CEREMONY: 'IN_CEREMONY',
  CEREMONY_COMPLETED: 'CEREMONY_COMPLETED',
  AWAITING_CREMATION: 'AWAITING_CREMATION',
  IN_CREMATION: 'IN_CREMATION',
  CREMATED: 'CREMATED',
  ASHES_STORED: 'ASHES_STORED',
  ASHES_PICKED_UP: 'ASHES_PICKED_UP',
  CANCELLED: 'CANCELLED',
} as const;

export type RemainsStatus = typeof RemainsStatus[keyof typeof RemainsStatus];

export const StorageType = {
  NORMAL: 'NORMAL',
  LOW_TEMP: 'LOW_TEMP',
  SPECIAL: 'SPECIAL',
} as const;

export type StorageType = typeof StorageType[keyof typeof StorageType];

export const CabinetStatus = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  MAINTENANCE: 'MAINTENANCE',
  CLEANING: 'CLEANING',
} as const;

export type CabinetStatus = typeof CabinetStatus[keyof typeof CabinetStatus];

export const HallStatus = {
  AVAILABLE: 'AVAILABLE',
  IN_USE: 'IN_USE',
  MAINTENANCE: 'MAINTENANCE',
  CLEANING: 'CLEANING',
} as const;

export type HallStatus = typeof HallStatus[keyof typeof HallStatus];

export const CeremonyStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
} as const;

export type CeremonyStatus = typeof CeremonyStatus[keyof typeof CeremonyStatus];

export const FurnaceType = {
  TYPE_A: 'TYPE_A',
  TYPE_B: 'TYPE_B',
  TYPE_C: 'TYPE_C',
} as const;

export type FurnaceType = typeof FurnaceType[keyof typeof FurnaceType];

export const FurnaceStatus = {
  AVAILABLE: 'AVAILABLE',
  IN_USE: 'IN_USE',
  MAINTENANCE: 'MAINTENANCE',
  COOLING_DOWN: 'COOLING_DOWN',
} as const;

export type FurnaceStatus = typeof FurnaceStatus[keyof typeof FurnaceStatus];

export const CremationStatus = {
  QUEUED: 'QUEUED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type CremationStatus = typeof CremationStatus[keyof typeof CremationStatus];

export const NicheLevel = {
  NORMAL: 'NORMAL',
  DELUXE: 'DELUXE',
  PREMIUM: 'PREMIUM',
} as const;

export type NicheLevel = typeof NicheLevel[keyof typeof NicheLevel];

export const NicheStatus = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type NicheStatus = typeof NicheStatus[keyof typeof NicheStatus];

export const PickupStatus = {
  NOT_PICKED: 'NOT_PICKED',
  PENDING_PICKUP: 'PENDING_PICKUP',
  PICKED_UP: 'PICKED_UP',
} as const;

export type PickupStatus = typeof PickupStatus[keyof typeof PickupStatus];

export const FeeCategory = {
  TRANSPORT: 'TRANSPORT',
  STORAGE: 'STORAGE',
  CEREMONY: 'CEREMONY',
  CREMATION: 'CREMATION',
  NICHE_STORAGE: 'NICHE_STORAGE',
  OTHER: 'OTHER',
} as const;

export type FeeCategory = typeof FeeCategory[keyof typeof FeeCategory];

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIAL_PAID: 'PARTIAL_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  ALIPAY: 'ALIPAY',
  WECHAT: 'WECHAT',
  TRANSFER: 'TRANSFER',
} as const;

export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

export const ShiftType = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  NIGHT: 'NIGHT',
  DAY_OFF: 'DAY_OFF',
} as const;

export type ShiftType = typeof ShiftType[keyof typeof ShiftType];

export const RequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type RequestStatus = typeof RequestStatus[keyof typeof RequestStatus];

export const NotificationType = {
  OVERDUE_REMINDER: 'OVERDUE_REMINDER',
  CEREMONY_APPROVAL: 'CEREMONY_APPROVAL',
  SHIFT_REQUEST: 'SHIFT_REQUEST',
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
  SYSTEM: 'SYSTEM',
} as const;

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];
