export interface User {
  id: string;
  username: string;
  realName: string;
  role: string;
  phone?: string;
  skills?: string[];
  maxWorkHours?: number;
}

export interface Remains {
  id: string;
  name: string;
  gender: string;
  idCardNumber: string;
  birthDate: string;
  deathDate: string;
  deathCause: string;
  deathCertNumber: string;
  deathCertIssuer: string;
  familyName: string;
  familyPhone: string;
  familyRelation: string;
  status: RemainsStatus;
  storageRequirement: string;
  expectedCeremonyTime?: string;
  cabinetId?: string;
  createdAt: string;
  updatedAt: string;
  cabinet?: StorageCabinet;
  ceremony?: Ceremony;
  cremation?: Cremation;
  ashes?: Ashes;
}

export type RemainsStatus =
  | 'REGISTERED'
  | 'IN_STORAGE'
  | 'CEREMONY_SCHEDULED'
  | 'IN_CEREMONY'
  | 'CEREMONY_COMPLETED'
  | 'AWAITING_CREMATION'
  | 'IN_CREMATION'
  | 'CREMATED'
  | 'ASHES_STORED'
  | 'ASHES_PICKED_UP'
  | 'CANCELLED';

export const REMAINS_STATUS_MAP: Record<RemainsStatus, string> = {
  REGISTERED: '已登记',
  IN_STORAGE: '冷藏中',
  CEREMONY_SCHEDULED: '告别待办',
  IN_CEREMONY: '告别中',
  CEREMONY_COMPLETED: '告别完成',
  AWAITING_CREMATION: '待火化',
  IN_CREMATION: '火化中',
  CREMATED: '已火化',
  ASHES_STORED: '骨灰寄存',
  ASHES_PICKED_UP: '骨灰已领',
  CANCELLED: '已取消',
};

export interface StorageCabinet {
  id: string;
  cabinetNo: string;
  row: number;
  col: number;
  type: string;
  status: string;
  temperature?: number;
}

export interface CeremonyHall {
  id: string;
  hallNo: string;
  name: string;
  capacity: number;
  facilities: string[];
  status: string;
}

export interface Ceremony {
  id: string;
  remainsId: string;
  hallId: string;
  hostId: string;
  startTime: string;
  endTime: string;
  status: CeremonyStatus;
  familyPreference?: string;
  approvedBy?: string;
  approvedAt?: string;
  remains?: { name: string; familyName: string; familyPhone: string };
  hall?: CeremonyHall;
  host?: { realName: string; phone?: string };
}

export type CeremonyStatus = 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

export const CEREMONY_STATUS_MAP: Record<CeremonyStatus, string> = {
  PENDING: '待审批',
  APPROVED: '已审批',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REJECTED: '已拒绝',
};

export interface CremationFurnace {
  id: string;
  furnaceNo: string;
  type: string;
  status: string;
  fuelLevel: number;
}

export interface Cremation {
  id: string;
  remainsId: string;
  furnaceId: string;
  startTime?: string;
  endTime?: string;
  fuelUsed?: number;
  emissionLevel?: number;
  sequence: number;
  status: CremationStatus;
  remains?: { name: string; familyName: string };
  furnace?: CremationFurnace;
}

export type CremationStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export const CREMATION_STATUS_MAP: Record<CremationStatus, string> = {
  QUEUED: '排队中',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export interface AshesNiche {
  id: string;
  nicheNo: string;
  area: string;
  row: number;
  col: number;
  level: string;
  price: number;
  status: string;
}

export interface Ashes {
  id: string;
  remainsId: string;
  nicheId: string;
  storageStart: string;
  storageEnd?: string;
  pickupCode: string;
  pickupStatus: PickupStatus;
  pickedUpBy?: string;
  pickedUpAt?: string;
  remains?: { name: string; familyName: string; familyPhone: string };
  niche?: AshesNiche;
}

export type PickupStatus = 'NOT_PICKED' | 'PENDING_PICKUP' | 'PICKED_UP';

export const PICKUP_STATUS_MAP: Record<PickupStatus, string> = {
  NOT_PICKED: '未领取',
  PENDING_PICKUP: '待领取',
  PICKED_UP: '已领取',
};

export interface FeeItem {
  id: string;
  category: string;
  name: string;
  price: number;
  unit: string;
  description?: string;
}

export interface FeeRecord {
  id: string;
  remainsId: string;
  feeItemId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  feeItem?: FeeItem;
}

export interface Payment {
  id: string;
  remainsId: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paidAt?: string;
  records?: FeeRecord[];
}

export type PaymentStatus = 'UNPAID' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE';

export const PAYMENT_STATUS_MAP: Record<PaymentStatus, string> = {
  UNPAID: '未缴费',
  PARTIAL_PAID: '部分缴费',
  PAID: '已缴清',
  OVERDUE: '已逾期',
};

export type PaymentMethod = 'CASH' | 'CARD' | 'ALIPAY' | 'WECHAT' | 'TRANSFER';

export const PAYMENT_METHOD_MAP: Record<PaymentMethod, string> = {
  CASH: '现金',
  CARD: '银行卡',
  ALIPAY: '支付宝',
  WECHAT: '微信',
  TRANSFER: '转账',
};

export interface Schedule {
  id: string;
  userId: string;
  date: string;
  shiftType: ShiftType;
  user?: { realName: string; role: string; phone?: string };
}

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'DAY_OFF';

export const SHIFT_TYPE_MAP: Record<ShiftType, string> = {
  MORNING: '早班',
  AFTERNOON: '午班',
  NIGHT: '夜班',
  DAY_OFF: '休息',
};

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  targetId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface StatisticsOverview {
  today: {
    remains: number;
    ceremonies: number;
    cremations: number;
  };
  monthRevenue: number;
  remainsByStatus: Array<{ status: string; count: number }>;
}
