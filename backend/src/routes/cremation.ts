import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { CremationStatus, FurnaceStatus, RemainsStatus, FurnaceType } from '../types/enums';
import dayjs from 'dayjs';

const router = Router();
router.use(authMiddleware);

const MIN_FUEL_THRESHOLD = 20;
const MAX_EMISSION_LEVEL = 80;
const FUEL_CONSUMPTION_PER_CREMATION = 15;

const FURNACE_ECO_RATING: Record<string, number> = {
  [FurnaceType.TYPE_A]: 95,
  [FurnaceType.TYPE_B]: 80,
  [FurnaceType.TYPE_C]: 65,
};

const FURNACE_NAMES: Record<string, string> = {
  [FurnaceType.TYPE_A]: 'A型环保炉',
  [FurnaceType.TYPE_B]: 'B型标准炉',
  [FurnaceType.TYPE_C]: 'C型普通炉',
};

export const generateCremationSequence = async () => {
  const remainsList = await prisma.remains.findMany({
    where: {
      status: { in: ['CEREMONY_COMPLETED', 'AWAITING_CREMATION'] },
    },
    orderBy: { deathDate: 'asc' },
    include: {
      ceremony: true,
    },
  });

  if (remainsList.length === 0) return { cremations: [], reasons: [] };

  const allFurnaces = await prisma.cremationFurnace.findMany({
    where: {
      status: { in: [FurnaceStatus.AVAILABLE, FurnaceStatus.COOLING_DOWN] },
    },
    orderBy: [
      { type: 'asc' },
      { fuelLevel: 'desc' },
    ],
  });

  const availableFurnaces = allFurnaces.filter((f) => {
    if (f.status !== FurnaceStatus.AVAILABLE) return false;
    if (f.fuelLevel < MIN_FUEL_THRESHOLD) return false;
    const ecoRating = FURNACE_ECO_RATING[f.type] || 0;
    if (ecoRating < 60) return false;
    return true;
  });

  if (availableFurnaces.length === 0) {
    const disabled = allFurnaces.filter((f) => f.status === FurnaceStatus.AVAILABLE);
    const lowFuel = disabled.filter((f) => f.fuelLevel < MIN_FUEL_THRESHOLD).length;
    const lowEco = disabled.filter((f) => (FURNACE_ECO_RATING[f.type] || 0) < 60).length;
    const cooling = allFurnaces.filter((f) => f.status === FurnaceStatus.COOLING_DOWN).length;
    const reasons = [];
    if (lowFuel > 0) reasons.push(`${lowFuel}台燃料不足(<${MIN_FUEL_THRESHOLD}%)`);
    if (lowEco > 0) reasons.push(`${lowEco}台环保不达标(<60分)`);
    if (cooling > 0) reasons.push(`${cooling}台冷却中`);
    throw new AppError(`暂无可用火化炉（${reasons.join('；')}），请先补充燃料、维护或等待冷却`, 400);
  }

  const existingQueued = await prisma.cremation.count({
    where: { status: CremationStatus.QUEUED },
  });

  const cremations: any[] = [];
  const allocationReasons: string[] = [];
  const furnaceRemainingFuel = new Map<string, number>();
  const furnaceQueueCount = new Map<string, number>();

  availableFurnaces.forEach((f) => {
    furnaceRemainingFuel.set(f.id, f.fuelLevel);
    furnaceQueueCount.set(f.id, 0);
  });

  const sortedRemains = [...remainsList].sort((a, b) => {
    const aHasCeremony = !!a.ceremony;
    const bHasCeremony = !!b.ceremony;
    if (aHasCeremony !== bHasCeremony) return aHasCeremony ? -1 : 1;
    return a.deathDate.getTime() - b.deathDate.getTime();
  });

  for (let i = 0; i < sortedRemains.length; i++) {
    const remains = sortedRemains[i];
    const existing = await prisma.cremation.findUnique({ where: { remainsId: remains.id } });
    if (existing) continue;

    const sequenceNo = existingQueued + cremations.length + 1;

    const ecoFurnaces = availableFurnaces.filter(
      (f) => FURNACE_ECO_RATING[f.type] >= 80
    );

    const candidates = ecoFurnaces.length > 0 ? ecoFurnaces : availableFurnaces;

    let bestScore = -Infinity;
    let selectedFurnace: any = null;
    let sortReasons: string[] = [];

    for (const furnace of candidates) {
      const remainingFuel = furnaceRemainingFuel.get(furnace.id) || 0;
      const queueCount = furnaceQueueCount.get(furnace.id) || 0;
      const canFit = remainingFuel - FUEL_CONSUMPTION_PER_CREMATION >= MIN_FUEL_THRESHOLD;

      if (!canFit) continue;

      const ecoScore = FURNACE_ECO_RATING[furnace.type] || 0;
      const queueScore = -queueCount * 10;
      const fuelScore = remainingFuel;
      const score = ecoScore * 0.4 + queueScore + fuelScore * 0.2;

      if (score > bestScore) {
        bestScore = score;
        selectedFurnace = furnace;
      }
    }

    if (!selectedFurnace) {
      const backup = availableFurnaces.find((f) => {
        const remaining = furnaceRemainingFuel.get(f.id) || 0;
        return remaining >= FUEL_CONSUMPTION_PER_CREMATION;
      });
      if (backup) {
        selectedFurnace = backup;
      }
    }

    if (!selectedFurnace) {
      allocationReasons.push(`【${remains.name}】所有炉燃料不足，无法安排`);
      continue;
    }

    const furnaceType = selectedFurnace.type;
    const ecoRating = FURNACE_ECO_RATING[furnaceType] || 0;
    const remainingFuel = furnaceRemainingFuel.get(selectedFurnace.id) || 0;
    const queueCount = furnaceQueueCount.get(selectedFurnace.id) || 0;
    const typeName = FURNACE_NAMES[furnaceType] || furnaceType;

    sortReasons.push(`序列#${sequenceNo}：`);
    sortReasons.push(`选择${selectedFurnace.furnaceNo}(${typeName})`);
    sortReasons.push(`环保评级${ecoRating}分${ecoRating >= 80 ? '(优先推荐)' : ''}`);
    sortReasons.push(`剩余燃料${remainingFuel.toFixed(0)}%≥${MIN_FUEL_THRESHOLD}%阈值`);
    if (queueCount > 0) {
      sortReasons.push(`该炉当前队列${queueCount}具，负载均衡`);
    } else {
      sortReasons.push(`该炉当前空闲，优先分配`);
    }
    if (remains.ceremony) {
      sortReasons.push(`已完成告别仪式，优先处理`);
    } else {
      sortReasons.push(`按死亡日期排序（${dayjs(remains.deathDate).format('YYYY-MM-DD')}）`);
    }

    cremations.push({
      remainsId: remains.id,
      furnaceId: selectedFurnace.id,
      sequence: sequenceNo,
      status: CremationStatus.QUEUED,
      sortReason: sortReasons.join('；'),
    });

    const newFuel = remainingFuel - FUEL_CONSUMPTION_PER_CREMATION;
    furnaceRemainingFuel.set(selectedFurnace.id, Math.max(0, newFuel));
    furnaceQueueCount.set(selectedFurnace.id, queueCount + 1);
  }

  return {
    cremations,
    reasons: allocationReasons,
    furnaceStats: availableFurnaces.map((f) => ({
      id: f.id,
      furnaceNo: f.furnaceNo,
      type: f.type,
      typeName: FURNACE_NAMES[f.type] || f.type,
      initialFuel: f.fuelLevel,
      remainingFuel: furnaceRemainingFuel.get(f.id) || 0,
      allocated: furnaceQueueCount.get(f.id) || 0,
      ecoRating: FURNACE_ECO_RATING[f.type] || 0,
      ecoPass: (FURNACE_ECO_RATING[f.type] || 0) >= 60,
    })),
    excludedFurnaces: allFurnaces.filter((f) => !availableFurnaces.includes(f)).map((f) => ({
      id: f.id,
      furnaceNo: f.furnaceNo,
      status: f.status,
      fuelLevel: f.fuelLevel,
      ecoRating: FURNACE_ECO_RATING[f.type] || 0,
      reason: f.status !== FurnaceStatus.AVAILABLE
        ? `状态：${f.status}`
        : f.fuelLevel < MIN_FUEL_THRESHOLD
          ? `燃料不足${f.fuelLevel}%<${MIN_FUEL_THRESHOLD}%`
          : `环保不达标${FURNACE_ECO_RATING[f.type] || 0}分<60分`
    })),
  };
};

router.post('/generate-sequence', async (req, res, next) => {
  try {
    const result = await generateCremationSequence();
    const { cremations } = result;

    if (cremations.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const c of cremations) {
          await tx.cremation.create({ data: c });
          await tx.remains.update({
            where: { id: c.remainsId },
            data: { status: RemainsStatus.AWAITING_CREMATION },
          });
        }
      });
    }

    res.json({
      count: cremations.length,
      cremations,
      reasons: result.reasons,
      furnaceStats: result.furnaceStats,
      algorithmInfo: {
        minFuelThreshold: MIN_FUEL_THRESHOLD,
        maxEmission: MAX_EMISSION_LEVEL,
        fuelPerCremation: FUEL_CONSUMPTION_PER_CREMATION,
        ecoPriority: '优先选择环保等级≥80分的火化炉',
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', [
  query('status').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.status) where.status = req.query.status;

    const cremations = await prisma.cremation.findMany({
      where,
      include: {
        remains: { select: { id: true, name: true, familyName: true } },
        furnace: true,
      },
      orderBy: [{ status: 'asc' }, { sequence: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(cremations);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    const cremation = await prisma.cremation.findUnique({
      where: { id: req.params.id },
      include: { furnace: true },
    });
    if (!cremation) throw new AppError('火化记录不存在', 404);
    if (cremation.status !== CremationStatus.QUEUED) {
      throw new AppError('仅排队中状态可开始', 400);
    }

    if (cremation.furnace.fuelLevel < MIN_FUEL_THRESHOLD) {
      throw new AppError(`火化炉燃料不足（低于${MIN_FUEL_THRESHOLD}%），请先补充燃料`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.cremation.update({
        where: { id: req.params.id },
        data: {
          status: CremationStatus.IN_PROGRESS,
          startTime: new Date(),
        },
      });
      await tx.cremationFurnace.update({
        where: { id: cremation.furnaceId },
        data: { status: FurnaceStatus.IN_USE },
      });
      await tx.remains.update({
        where: { id: cremation.remainsId },
        data: { status: RemainsStatus.IN_CREMATION },
      });
      return c;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/complete', [
  body('fuelUsed').isFloat({ min: 0 }).withMessage('燃料使用量必须为正数'),
  body('emissionLevel').isFloat({ min: 0 }).withMessage('排放值必须为正数'),
  validateRequest,
], async (req, res, next) => {
  try {
    const { fuelUsed, emissionLevel } = req.body;
    const cremation = await prisma.cremation.findUnique({ where: { id: req.params.id } });
    if (!cremation) throw new AppError('火化记录不存在', 404);
    if (cremation.status !== CremationStatus.IN_PROGRESS) {
      throw new AppError('仅进行中状态可完成', 400);
    }

    if (emissionLevel > MAX_EMISSION_LEVEL) {
      throw new AppError(`排放值超标（超过${MAX_EMISSION_LEVEL}），请检查环保设备后再确认`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.cremation.update({
        where: { id: req.params.id },
        data: {
          status: CremationStatus.COMPLETED,
          endTime: new Date(),
          fuelUsed,
          emissionLevel,
        },
      });

      const furnace = await tx.cremationFurnace.findUnique({ where: { id: cremation.furnaceId } });
      const newFuelLevel = Math.max(0, (furnace?.fuelLevel || 0) - fuelUsed);

      await tx.cremationFurnace.update({
        where: { id: cremation.furnaceId },
        data: {
          status: FurnaceStatus.COOLING_DOWN,
          fuelLevel: newFuelLevel,
        },
      });

      await tx.remains.update({
        where: { id: cremation.remainsId },
        data: { status: RemainsStatus.CREMATED },
      });

      return { ...c, remainingFuel: newFuelLevel };
    });

    res.json({
      ...updated,
      emissionCheck: emissionLevel <= MAX_EMISSION_LEVEL ? '合格' : '超标',
      fuelWarning: updated.remainingFuel < MIN_FUEL_THRESHOLD ? '燃料不足，需补充' : '燃料充足',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/furnaces/list', async (req, res, next) => {
  try {
    const furnaces = await prisma.cremationFurnace.findMany({
      orderBy: { furnaceNo: 'asc' },
    });
    const result = furnaces.map((f) => ({
      ...f,
      ecoRating: FURNACE_ECO_RATING[f.type] || 0,
      typeName: FURNACE_NAMES[f.type] || f.type,
      fuelWarning: f.fuelLevel < MIN_FUEL_THRESHOLD,
    }));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/furnaces/:id/refuel', [
  body('amount').isFloat({ min: 0, max: 100 }).withMessage('燃料量应在0-100之间'),
  validateRequest,
], async (req, res, next) => {
  try {
    const { amount } = req.body;
    const furnace = await prisma.cremationFurnace.findUnique({ where: { id: req.params.id } });
    if (!furnace) throw new AppError('火化炉不存在', 404);

    const updated = await prisma.cremationFurnace.update({
      where: { id: req.params.id },
      data: {
        fuelLevel: Math.min(100, furnace.fuelLevel + amount),
      },
    });

    res.json({
      ...updated,
      ecoRating: FURNACE_ECO_RATING[updated.type] || 0,
      typeName: FURNACE_NAMES[updated.type] || updated.type,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
