import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { NicheStatus, PickupStatus, RemainsStatus } from '../types/enums';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authMiddleware);

export const allocateNiche = async (level?: string, area?: string) => {
  const where: any = { status: NicheStatus.AVAILABLE };
  if (level) where.level = level;
  if (area) where.area = area;

  const availableNiches = await prisma.ashesNiche.findMany({
    where,
    orderBy: [
      { area: 'asc' },
      { row: 'asc' },
      { col: 'asc' },
    ],
    take: 5,
  });

  if (availableNiches.length === 0) {
    throw new AppError('暂无可用骨灰格位', 400);
  }

  return availableNiches[0];
};

router.post('/allocate', [
  body('remainsId').notEmpty().withMessage('遗体ID不能为空'),
  body('level').optional().isIn(['NORMAL', 'DELUXE', 'PREMIUM']),
  body('area').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const { remainsId, level, area } = req.body;

    const remains = await prisma.remains.findUnique({ where: { id: remainsId } });
    if (!remains) throw new AppError('遗体记录不存在', 404);
    if (remains.status !== RemainsStatus.CREMATED) {
      throw new AppError('仅已火化遗体可分配骨灰格位', 400);
    }

    const existing = await prisma.ashes.findUnique({ where: { remainsId } });
    if (existing) throw new AppError('该遗体已分配骨灰格位', 400);

    const niche = await allocateNiche(level, area);
    const pickupCode = uuidv4().slice(0, 8).toUpperCase();

    const ashes = await prisma.$transaction(async (tx) => {
      await tx.ashesNiche.update({
        where: { id: niche.id },
        data: { status: NicheStatus.OCCUPIED },
      });

      const data = await tx.ashes.create({
        data: {
          remainsId,
          nicheId: niche.id,
          storageStart: new Date(),
          pickupCode,
        },
        include: {
          remains: { select: { name: true, familyName: true, familyPhone: true } },
          niche: true,
        },
      });

      await tx.remains.update({
        where: { id: remainsId },
        data: { status: RemainsStatus.ASHES_STORED },
      });

      return data;
    });

    res.json({
      ashes,
      pickupCode,
      message: `已分配格位 ${niche.nicheNo}，领取凭证码：${pickupCode}`,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', [
  query('pickupStatus').optional().isString(),
  query('keyword').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.pickupStatus) where.pickupStatus = req.query.pickupStatus;
    if (req.query.keyword) {
      where.OR = [
        { remains: { name: { contains: req.query.keyword as string } } },
        { pickupCode: { contains: req.query.keyword as string } },
      ];
    }

    const ashes = await prisma.ashes.findMany({
      where,
      include: {
        remains: { select: { id: true, name: true, familyName: true, familyPhone: true } },
        niche: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ashes);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pickup', [
  body('pickedUpBy').notEmpty().withMessage('领取人不能为空'),
  body('pickupCode').notEmpty().withMessage('领取凭证码不能为空'),
  validateRequest,
], async (req, res, next) => {
  try {
    const { pickedUpBy, pickupCode } = req.body;
    const ashes = await prisma.ashes.findUnique({
      where: { id: req.params.id },
      include: { niche: true },
    });
    if (!ashes) throw new AppError('骨灰记录不存在', 404);
    if (ashes.pickupCode !== pickupCode.toUpperCase()) {
      throw new AppError('领取凭证码错误', 400);
    }
    if (ashes.pickupStatus === PickupStatus.PICKED_UP) {
      throw new AppError('该骨灰已被领取', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.ashes.update({
        where: { id: req.params.id },
        data: {
          pickupStatus: PickupStatus.PICKED_UP,
          pickedUpBy,
          pickedUpAt: new Date(),
          storageEnd: new Date(),
        },
      });

      await tx.ashesNiche.update({
        where: { id: ashes.nicheId },
        data: { status: NicheStatus.AVAILABLE },
      });

      await tx.remains.update({
        where: { id: ashes.remainsId },
        data: { status: RemainsStatus.ASHES_PICKED_UP },
      });

      return a;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/niches/stats', async (req, res, next) => {
  try {
    const niches = await prisma.ashesNiche.findMany({
      include: {
        ashes: {
          where: { pickupStatus: 'NOT_PICKED' },
          select: { id: true },
        },
      },
    });

    const stats: any = {
      total: niches.length,
      available: 0,
      occupied: 0,
      reserved: 0,
      byLevel: {
        NORMAL: { total: 0, available: 0, occupied: 0 },
        DELUXE: { total: 0, available: 0, occupied: 0 },
        PREMIUM: { total: 0, available: 0, occupied: 0 },
      },
    };

    for (const niche of niches) {
      const levelKey = niche.level as keyof typeof stats.byLevel;
      stats.byLevel[levelKey].total++;

      if (niche.status === NicheStatus.AVAILABLE) {
        stats.available++;
        stats.byLevel[levelKey].available++;
      } else if (niche.status === NicheStatus.OCCUPIED || niche.ashes.length > 0) {
        stats.occupied++;
        stats.byLevel[levelKey].occupied++;
      } else if (niche.status === NicheStatus.RESERVED) {
        stats.reserved++;
      }
    }

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/niches/list', async (req, res, next) => {
  try {
    const niches = await prisma.ashesNiche.findMany({
      include: {
        ashes: {
          where: { pickupStatus: 'NOT_PICKED' },
          include: { remains: { select: { name: true } } },
        },
      },
      orderBy: [{ area: 'asc' }, { row: 'asc' }, { col: 'asc' }],
    });
    res.json(niches);
  } catch (error) {
    next(error);
  }
});

export default router;
