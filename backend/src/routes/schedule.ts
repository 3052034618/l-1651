import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRoles } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { ShiftType, RequestStatus, UserRole } from '../types/enums';
import dayjs from 'dayjs';

const router = Router();
router.use(authMiddleware);

export const generateWeeklySchedule = async (startDate: Date) => {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.STAFF, UserRole.HOST, UserRole.CREMATOR, UserRole.RECEPTION] },
    },
  });

  if (users.length === 0) return [];

  const schedules: any[] = [];
  const shifts = [ShiftType.MORNING, ShiftType.AFTERNOON, ShiftType.NIGHT];

  for (let day = 0; day < 7; day++) {
    const date = dayjs(startDate).add(day, 'day').startOf('day').toDate();

    const shiftUserCount: Record<string, number> = {
      [ShiftType.MORNING]: 0,
      [ShiftType.AFTERNOON]: 0,
      [ShiftType.NIGHT]: 0,
    };

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      let shiftType: ShiftType;

      if (day === 0 && i % 7 === 0) {
        shiftType = ShiftType.DAY_OFF;
      } else if (day === 6 && i % 5 === 0) {
        shiftType = ShiftType.DAY_OFF;
      } else {
        const shiftIndex = (i + day) % 3;
        shiftType = shifts[shiftIndex];
      }

      if (shiftType !== ShiftType.DAY_OFF) {
        shiftUserCount[shiftType]++;
      }

      schedules.push({
        userId: user.id,
        date,
        shiftType,
      });
    }
  }

  return schedules;
};

router.post('/generate-weekly', requireRoles(UserRole.ADMIN, UserRole.SUPERVISOR), [
  body('startDate').notEmpty().withMessage('开始日期不能为空'),
  validateRequest,
], async (req, res, next) => {
  try {
    const startDate = new Date(req.body.startDate);
    const startOfWeek = dayjs(startDate).startOf('week').toDate();
    const endOfWeek = dayjs(startOfWeek).endOf('week').toDate();

    const existingCount = await prisma.schedule.count({
      where: {
        date: { gte: startOfWeek, lte: endOfWeek },
      },
    });

    if (existingCount > 0) {
      await prisma.schedule.deleteMany({
        where: {
          date: { gte: startOfWeek, lte: endOfWeek },
        },
      });
    }

    const schedules = await generateWeeklySchedule(startOfWeek);

    const created = await prisma.$transaction(async (tx) => {
      const result: any[] = [];
      for (const s of schedules) {
        const created = await tx.schedule.create({
          data: s,
          include: { user: { select: { realName: true, role: true } } },
        });
        result.push(created);
      }
      return result;
    });

    res.json({ count: created.length, schedules: created });
  } catch (error) {
    next(error);
  }
});

router.get('/', [
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  query('userId').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.startDate) where.date = { ...where.date, gte: new Date(req.query.startDate as string) };
    if (req.query.endDate) where.date = { ...where.date, lte: new Date(req.query.endDate as string) };
    if (req.query.userId) where.userId = req.query.userId;

    const schedules = await prisma.schedule.findMany({
      where,
      include: { user: { select: { realName: true, role: true, phone: true } } },
      orderBy: [{ date: 'asc' }, { userId: 'asc' }],
    });
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

router.get('/my-schedule', async (req: AuthRequest, res, next) => {
  try {
    const startOfWeek = dayjs().startOf('week').toDate();
    const endOfWeek = dayjs().endOf('week').toDate();

    const schedules = await prisma.schedule.findMany({
      where: {
        userId: req.user!.id,
        date: { gte: startOfWeek, lte: endOfWeek },
      },
      orderBy: { date: 'asc' },
    });
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

router.post('/shift-request', [
  body('originalDate').notEmpty().withMessage('原班次日期不能为空'),
  body('originalShift').isIn(['MORNING', 'AFTERNOON', 'NIGHT', 'DAY_OFF']),
  body('requestedDate').notEmpty().withMessage('调班日期不能为空'),
  body('requestedShift').isIn(['MORNING', 'AFTERNOON', 'NIGHT', 'DAY_OFF']),
  body('reason').notEmpty().withMessage('调班原因不能为空'),
  validateRequest,
], async (req: AuthRequest, res, next) => {
  try {
    const request = await prisma.shiftRequest.create({
      data: {
        userId: req.user!.id,
        originalDate: new Date(req.body.originalDate),
        originalShift: req.body.originalShift,
        requestedDate: new Date(req.body.requestedDate),
        requestedShift: req.body.requestedShift,
        reason: req.body.reason,
      },
    });
    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.get('/shift-requests', [
  query('status').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.status) where.status = req.query.status;

    const requests = await prisma.shiftRequest.findMany({
      where,
      include: { user: { select: { realName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.post('/shift-requests/:id/approve', requireRoles(UserRole.ADMIN, UserRole.SUPERVISOR), async (req: AuthRequest, res, next) => {
  try {
    const shiftRequest = await prisma.shiftRequest.findUnique({ where: { id: req.params.id } });
    if (!shiftRequest) throw new AppError('调班申请不存在', 404);
    if (shiftRequest.status !== RequestStatus.PENDING) {
      throw new AppError('仅待审批状态可审批', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.shiftRequest.update({
        where: { id: req.params.id },
        data: {
          status: RequestStatus.APPROVED,
          approvedBy: req.user!.id,
          approvedAt: new Date(),
        },
      });

      await tx.schedule.upsert({
        where: {
          userId_date: {
            userId: shiftRequest.userId,
            date: shiftRequest.originalDate,
          },
        },
        update: { shiftType: ShiftType.DAY_OFF },
        create: {
          userId: shiftRequest.userId,
          date: shiftRequest.originalDate,
          shiftType: ShiftType.DAY_OFF,
        },
      });

      await tx.schedule.upsert({
        where: {
          userId_date: {
            userId: shiftRequest.userId,
            date: shiftRequest.requestedDate,
          },
        },
        update: { shiftType: shiftRequest.requestedShift },
        create: {
          userId: shiftRequest.userId,
          date: shiftRequest.requestedDate,
          shiftType: shiftRequest.requestedShift,
        },
      });
    });

    res.json({ message: '调班申请已批准' });
  } catch (error) {
    next(error);
  }
});

router.post('/shift-requests/:id/reject', requireRoles(UserRole.ADMIN, UserRole.SUPERVISOR), [
  body('reason').notEmpty().withMessage('拒绝原因不能为空'),
  validateRequest,
], async (req: AuthRequest, res, next) => {
  try {
    const shiftRequest = await prisma.shiftRequest.findUnique({ where: { id: req.params.id } });
    if (!shiftRequest) throw new AppError('调班申请不存在', 404);

    await prisma.shiftRequest.update({
      where: { id: req.params.id },
      data: { status: RequestStatus.REJECTED },
    });

    res.json({ message: '调班申请已拒绝' });
  } catch (error) {
    next(error);
  }
});

export default router;
