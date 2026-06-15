import { StorageType, CabinetStatus } from '../types/enums';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface StorageCabinet {
  id: string;
  cabinetNo: string;
  row: number;
  col: number;
  type: string;
  status: string;
  temperature?: number | null;
}

export interface CabinetAllocationResult {
  cabinet: StorageCabinet;
  reason: string;
}

export const allocateOptimalCabinet = async (
  storageType: StorageType,
  expectedCeremonyTime?: Date
): Promise<CabinetAllocationResult> => {
  const availableCabinets = await prisma.storageCabinet.findMany({
    where: {
      type: storageType,
      status: CabinetStatus.AVAILABLE,
    },
    orderBy: [
      { row: 'asc' },
      { col: 'asc' },
    ],
  });

  if (availableCabinets.length === 0) {
    const allTypes = Object.values(StorageType);
    const otherTypes = allTypes.filter((t) => t !== storageType);

    for (const type of otherTypes) {
      const fallbackCabinets = await prisma.storageCabinet.findMany({
        where: {
          type: type,
          status: CabinetStatus.AVAILABLE,
        },
        orderBy: [{ row: 'asc' }, { col: 'asc' }],
        take: 1,
      });

      if (fallbackCabinets.length > 0) {
        return {
          cabinet: fallbackCabinets[0],
          reason: `目标类型柜位已满，已分配${type === StorageType.LOW_TEMP ? '低温' : type === StorageType.SPECIAL ? '特殊' : '普通'}冷藏柜位（升级）`,
        };
      }
    }

    throw new AppError('暂无可用冷藏柜位，请联系管理员', 400);
  }

  let optimalCabinet = availableCabinets[0];

  if (expectedCeremonyTime) {
    const now = new Date();
    const hoursToCeremony = (expectedCeremonyTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursToCeremony <= 24) {
      const groundFloor = availableCabinets.filter((c) => c.row <= 2);
      if (groundFloor.length > 0) {
        optimalCabinet = groundFloor[0];
        return {
          cabinet: optimalCabinet,
          reason: '告别时间在24小时内，已分配低层柜位便于取用',
        };
      }
    }
  }

  return {
    cabinet: optimalCabinet,
    reason: `已分配最优${storageType === StorageType.LOW_TEMP ? '低温' : storageType === StorageType.SPECIAL ? '特殊' : '普通'}冷藏柜位`,
  };
};

export const getCabinetStats = async () => {
  const cabinets = await prisma.storageCabinet.findMany({
    include: {
      remains: {
        where: {
          status: {
            in: ['REGISTERED', 'IN_STORAGE', 'CEREMONY_SCHEDULED'],
          },
        },
      },
    },
  });

  const stats = {
    total: cabinets.length,
    available: 0,
    occupied: 0,
    maintenance: 0,
    byType: {
      NORMAL: { total: 0, available: 0, occupied: 0 },
      LOW_TEMP: { total: 0, available: 0, occupied: 0 },
      SPECIAL: { total: 0, available: 0, occupied: 0 },
    },
  };

  for (const cabinet of cabinets) {
    const typeKey = cabinet.type as keyof typeof stats.byType;
    stats.byType[typeKey].total++;

    if (cabinet.status === CabinetStatus.AVAILABLE) {
      stats.available++;
      stats.byType[typeKey].available++;
    } else if (cabinet.status === CabinetStatus.OCCUPIED || cabinet.remains.length > 0) {
      stats.occupied++;
      stats.byType[typeKey].occupied++;
    } else if (cabinet.status === CabinetStatus.MAINTENANCE) {
      stats.maintenance++;
    }
  }

  return stats;
};
