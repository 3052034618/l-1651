import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { CremationStatus, FurnaceStatus, RemainsStatus } from '../types/enums';

const router = Router();
router.use(authMiddleware);

export const generateCremationSequence = async () => {
  const remainsList = await prisma.remains.findMany({
    where: {
      status: { in: ['CEREMONY_COMPLETED', 'AWAITING_CREMATION'] },
    },
    orderBy: { deathDate: 'asc' },
  });

  if (remainsList.length === 0) return [];

  const furnaces = await prisma.cremationFurnace.findMany({
    where: { status: FurnaceStatus.AVAILABLE },
    orderBy: [
      { fuelLevel: 'desc' },
      { type: 'asc' },
    ],
  });

  if (furnaces.length === 0) {
    throw new AppError('暂无可用火化炉', 400);
  }

  const existingQueued = await prisma.cremation.count({
    where: { status: CremationStatus.QUEUED },
  });

  const cremations: any[] = [];

  for (let i = 0; i < remainsList.length; i++) {
    const remains = remainsList[i];
    const existing = await prisma.cremation.findUnique({ where: { remainsId: remains.id } });
    if (existing) continue;

    const furnaceIndex = i % furnaces.length;
    const furnace = furnaces[furnaceIndex];

    cremations.push({
      remainsId: remains.id,
      furnaceId: furnace.id,
      sequence: existingQueued + i + 1,
      status: CremationStatus.QUEUED,
    });
  }

  return cremations;
};

router.post('/generate-sequence', async (req, res, next) => {
  try {
    const cremations = await generateCremationSequence();

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

    res.json({ count: cremations.length, cremations });
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

    if (cremation.furnace.fuelLevel < 20) {
      throw new AppError('火化炉燃料不足（低于20%），请先补充燃料', 400);
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

    if (emissionLevel > 80) {
      throw new AppError('排放值超标（超过80），请检查环保设备', 400);
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
      await tx.cremationFurnace.update({
        where: { id: cremation.furnaceId },
        data: {
          status: FurnaceStatus.COOLING_DOWN,
          fuelLevel: Math.max(0, (furnace?.fuelLevel || 0) - fuelUsed),
        },
      });

      await tx.remains.update({
        where: { id: cremation.remainsId },
        data: { status: RemainsStatus.CREMATED },
      });

      return c;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/furnaces/list', async (req, res, next) => {
  try {
    const furnaces = await prisma.cremationFurnace.findMany({
      orderBy: { furnaceNo: 'asc' },
    });
    res.json(furnaces);
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
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
