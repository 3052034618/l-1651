import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { validateRemainsInfo, validateIdCard } from '../utils/validation';
import { allocateOptimalCabinet, getCabinetStats } from '../utils/cabinetAllocation';
import { CabinetStatus, RemainsStatus, StorageType } from '../types/enums';
import { AppError } from '../middleware/errorHandler';
import dayjs from 'dayjs';

const router = Router();
router.use(authMiddleware);

router.post(
  '/validate-idcard',
  [body('idCardNumber').notEmpty().withMessage('身份证号不能为空'), validateRequest],
  async (req, res, next) => {
    try {
      const result = validateIdCard(req.body.idCardNumber);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  [
    body('name').notEmpty(),
    body('gender').isIn(['MALE', 'FEMALE', 'UNKNOWN']),
    body('idCardNumber').notEmpty(),
    body('deathDate').notEmpty(),
    body('deathCause').notEmpty(),
    body('deathCertNumber').notEmpty(),
    body('deathCertIssuer').notEmpty(),
    body('familyName').notEmpty(),
    body('familyPhone').notEmpty(),
    body('familyRelation').notEmpty(),
    body('storageRequirement').isIn(['NORMAL', 'LOW_TEMP', 'SPECIAL']),
    validateRequest,
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const validation = validateRemainsInfo(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          message: '信息校验失败',
          errors: validation.messages,
        });
      }

      const existing = await prisma.remains.findFirst({
        where: {
          OR: [
            { idCardNumber: req.body.idCardNumber },
            { deathCertNumber: req.body.deathCertNumber },
          ],
        },
      });
      if (existing) {
        return res.status(400).json({
          message: '该遗体信息已存在',
        });
      }

      const gender = validation.gender as Gender || req.body.gender;
      const birthDate = validation.birthDate || new Date(req.body.birthDate);

      const allocation = await allocateOptimalCabinet(
        req.body.storageRequirement,
        req.body.expectedCeremonyTime ? new Date(req.body.expectedCeremonyTime) : undefined
      );

      const remains = await prisma.$transaction(async (tx) => {
        await tx.storageCabinet.update({
          where: { id: allocation.cabinet.id },
          data: { status: CabinetStatus.OCCUPIED },
        });

        const data = await tx.remains.create({
          data: {
            name: req.body.name,
            gender,
            idCardNumber: req.body.idCardNumber,
            birthDate,
            deathDate: new Date(req.body.deathDate),
            deathCause: req.body.deathCause,
            deathCertNumber: req.body.deathCertNumber,
            deathCertIssuer: req.body.deathCertIssuer,
            familyName: req.body.familyName,
            familyPhone: req.body.familyPhone,
            familyRelation: req.body.familyRelation,
            storageRequirement: req.body.storageRequirement,
            expectedCeremonyTime: req.body.expectedCeremonyTime ? new Date(req.body.expectedCeremonyTime) : null,
            cabinetId: allocation.cabinet.id,
            status: RemainsStatus.IN_STORAGE,
            createdBy: req.user!.id,
          },
          include: {
            cabinet: true,
          },
        });
        return data;
      });

      res.json({
        remains,
        allocationMessage: allocation.reason,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  [
    query('status').optional().isString(),
    query('keyword').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const skip = (page - 1) * pageSize;

      const where: any = {};
      if (req.query.status) {
        where.status = req.query.status;
      }
      if (req.query.keyword) {
        where.OR = [
          { name: { contains: req.query.keyword as string } },
          { idCardNumber: { contains: req.query.keyword as string } },
          { familyName: { contains: req.query.keyword as string } },
          { familyPhone: { contains: req.query.keyword as string } },
        ];
      }

      const [total, list] = await Promise.all([
        prisma.remains.count({ where }),
        prisma.remains.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            cabinet: true,
            creator: { select: { realName: true } },
          },
        }),
      ]);

      res.json({ total, page, pageSize, list });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id', async (req, res, next) => {
  try {
    const remains = await prisma.remains.findUnique({
      where: { id: req.params.id },
      include: {
        cabinet: true,
        ceremony: { include: { hall: true, host: { select: { realName: true } } } },
        cremation: { include: { furnace: true } },
        ashes: { include: { niche: true } },
        fees: { include: { feeItem: true, payment: true } },
        creator: { select: { realName: true } },
      },
    });
    if (!remains) {
      throw new AppError('遗体记录不存在', 404);
    }
    res.json(remains);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/status', [
  body('status').notEmpty().withMessage('状态不能为空'),
  validateRequest,
], async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const remains = await prisma.remains.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(remains);
  } catch (error) {
    next(error);
  }
});

router.get('/cabinets/stats', async (req, res, next) => {
  try {
    const stats = await getCabinetStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/cabinets/list', async (req, res, next) => {
  try {
    const cabinets = await prisma.storageCabinet.findMany({
      include: {
        remains: {
          where: {
            status: {
              in: ['REGISTERED', 'IN_STORAGE', 'CEREMONY_SCHEDULED'],
            },
          },
          select: { id: true, name: true },
        },
      },
      orderBy: [{ row: 'asc' }, { col: 'asc' }],
    });
    res.json(cabinets);
  } catch (error) {
    next(error);
  }
});

router.get('/overdue/list', async (req, res, next) => {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const overdueList = await prisma.remains.findMany({
      where: {
        createdAt: { lt: threshold },
        status: {
          in: [
            RemainsStatus.REGISTERED,
            RemainsStatus.IN_STORAGE,
            RemainsStatus.CEREMONY_SCHEDULED,
          ],
        },
      },
      include: { cabinet: true },
      orderBy: { createdAt: 'asc' },
    });

    const result = overdueList.map((r) => ({
      ...r,
      overdueHours: Math.floor((now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60)),
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
