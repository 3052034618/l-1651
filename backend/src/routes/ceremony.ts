import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRoles } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { CeremonyStatus, HallStatus, UserRole } from '../types/enums';
import dayjs from 'dayjs';

const router = Router();
router.use(authMiddleware);

export const generateDailySchedule = async (date: Date) => {
  const startOfDay = dayjs(date).startOf('day').toDate();
  const endOfDay = dayjs(date).endOf('day').toDate();

  const remainsList = await prisma.remains.findMany({
    where: {
      expectedCeremonyTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        in: ['IN_STORAGE', 'CEREMONY_SCHEDULED'],
      },
    },
  });

  const halls = await prisma.ceremonyHall.findMany({
    where: { status: HallStatus.AVAILABLE },
  });

  const hosts = await prisma.user.findMany({
    where: {
      role: UserRole.HOST,
    },
  });

  const existingCeremonies = await prisma.ceremony.findMany({
    where: {
      startTime: { gte: startOfDay, lte: endOfDay },
      status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] },
    },
  });

  const hallOccupancy = new Map<string, Array<{ start: Date; end: Date }>>();
  const hostOccupancy = new Map<string, Array<{ start: Date; end: Date }>>();

  for (const c of existingCeremonies) {
    if (!hallOccupancy.has(c.hallId)) hallOccupancy.set(c.hallId, []);
    hallOccupancy.get(c.hallId)!.push({ start: c.startTime, end: c.endTime });

    if (!hostOccupancy.has(c.hostId)) hostOccupancy.set(c.hostId, []);
    hostOccupancy.get(c.hostId)!.push({ start: c.startTime, end: c.endTime });
  }

  const isSlotAvailable = (
    schedule: Array<{ start: Date; end: Date }>,
    start: Date,
    end: Date
  ): boolean => {
    for (const s of schedule) {
      if (start < s.end && end > s.start) return false;
    }
    return true;
  };

  const ceremonies: any[] = [];

  for (const remains of remainsList) {
    const existing = await prisma.ceremony.findUnique({ where: { remainsId: remains.id } });
    if (existing) continue;

    const preferredTime = remains.expectedCeremonyTime!;
    const durationMinutes = 60;
    const endTime = new Date(preferredTime.getTime() + durationMinutes * 60 * 1000);

    let allocated = false;

    const sortedHalls = [...halls].sort((a, b) => a.capacity - b.capacity);
    for (const hall of sortedHalls) {
      const hallSchedule = hallOccupancy.get(hall.id) || [];
      if (!isSlotAvailable(hallSchedule, preferredTime, endTime)) continue;

      for (const host of hosts) {
        const hostSchedule = hostOccupancy.get(host.id) || [];
        if (!isSlotAvailable(hostSchedule, preferredTime, endTime)) continue;

        ceremonies.push({
          remainsId: remains.id,
          hallId: hall.id,
          hostId: host.id,
          startTime: preferredTime,
          endTime,
          status: CeremonyStatus.PENDING,
        });

        hallSchedule.push({ start: preferredTime, end: endTime });
        hallOccupancy.set(hall.id, hallSchedule);
        hostSchedule.push({ start: preferredTime, end: endTime });
        hostOccupancy.set(host.id, hostSchedule);

        allocated = true;
        break;
      }
      if (allocated) break;
    }
  }

  return ceremonies;
};

router.post('/generate-schedule', [
  body('date').notEmpty().withMessage('日期不能为空'),
  validateRequest,
], async (req: AuthRequest, res, next) => {
  try {
    const date = new Date(req.body.date);
    const ceremonies = await generateDailySchedule(date);

    if (ceremonies.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const c of ceremonies) {
          await tx.ceremony.create({ data: c });
          await tx.remains.update({
            where: { id: c.remainsId },
            data: { status: 'CEREMONY_SCHEDULED' },
          });
        }
      });
    }

    res.json({ count: ceremonies.length, ceremonies });
  } catch (error) {
    next(error);
  }
});

router.get('/', [
  query('date').optional().isString(),
  query('status').optional().isString(),
  query('hallId').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.date) {
      const date = new Date(req.query.date as string);
      where.startTime = {
        gte: dayjs(date).startOf('day').toDate(),
        lte: dayjs(date).endOf('day').toDate(),
      };
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.hallId) where.hallId = req.query.hallId;

    const ceremonies = await prisma.ceremony.findMany({
      where,
      include: {
        remains: { select: { id: true, name: true, familyName: true, familyPhone: true } },
        hall: true,
        host: { select: { id: true, realName: true, phone: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(ceremonies);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/approve', requireRoles(UserRole.ADMIN, UserRole.SUPERVISOR), async (req: AuthRequest, res, next) => {
  try {
    const ceremony = await prisma.ceremony.findUnique({ where: { id: req.params.id } });
    if (!ceremony) throw new AppError('排程不存在', 404);
    if (ceremony.status !== CeremonyStatus.PENDING) {
      throw new AppError('仅待审批状态可审批', 400);
    }

    const updated = await prisma.ceremony.update({
      where: { id: req.params.id },
      data: {
        status: CeremonyStatus.APPROVED,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reject', requireRoles(UserRole.ADMIN, UserRole.SUPERVISOR), [
  body('reason').notEmpty().withMessage('拒绝原因不能为空'),
  validateRequest,
], async (req: AuthRequest, res, next) => {
  try {
    const ceremony = await prisma.ceremony.findUnique({ where: { id: req.params.id } });
    if (!ceremony) throw new AppError('排程不存在', 404);

    await prisma.$transaction(async (tx) => {
      await tx.ceremony.update({
        where: { id: req.params.id },
        data: { status: CeremonyStatus.REJECTED },
      });
      await tx.remains.update({
        where: { id: ceremony.remainsId },
        data: { status: 'IN_STORAGE' },
      });
    });

    res.json({ message: '已拒绝排程' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    const ceremony = await prisma.ceremony.findUnique({ where: { id: req.params.id } });
    if (!ceremony) throw new AppError('排程不存在', 404);
    if (ceremony.status !== CeremonyStatus.APPROVED) {
      throw new AppError('仅已审批状态可开始', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.ceremony.update({
        where: { id: req.params.id },
        data: { status: CeremonyStatus.IN_PROGRESS },
      });
      await tx.remains.update({
        where: { id: ceremony.remainsId },
        data: { status: 'IN_CEREMONY' },
      });
      return c;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const ceremony = await prisma.ceremony.findUnique({ where: { id: req.params.id } });
    if (!ceremony) throw new AppError('排程不存在', 404);

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.ceremony.update({
        where: { id: req.params.id },
        data: { status: CeremonyStatus.COMPLETED },
      });
      await tx.remains.update({
        where: { id: ceremony.remainsId },
        data: { status: 'CEREMONY_COMPLETED' },
      });
      return c;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/halls/list', async (req, res, next) => {
  try {
    const halls = await prisma.ceremonyHall.findMany({
      orderBy: { hallNo: 'asc' },
    });
    res.json(halls);
  } catch (error) {
    next(error);
  }
});

export default router;
