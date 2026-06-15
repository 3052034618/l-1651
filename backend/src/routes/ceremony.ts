import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRoles } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { CeremonyStatus, HallStatus, UserRole, NotificationType } from '../types/enums';
import { notifyRole, NotificationTemplates } from '../utils/notification';
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
    orderBy: { expectedCeremonyTime: 'asc' },
  });

  const halls = await prisma.ceremonyHall.findMany({
    where: { status: HallStatus.AVAILABLE },
    orderBy: { capacity: 'asc' },
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
    const attendees = remains.expectedAttendees || 50;
    const preference = remains.ceremonyPreference || '';

    let allocated = false;
    let allocationReason = '';

    const suitableHalls = halls.filter((h) => h.capacity >= attendees);
    if (suitableHalls.length === 0) {
      allocationReason = `无容量≥${attendees}人的厅室，使用最大容量${halls[halls.length - 1].capacity}人厅室`;
    } else {
      allocationReason = `按预计${attendees}人匹配容量≥${attendees}的厅室`;
    }

    const candidateHalls = suitableHalls.length > 0 ? suitableHalls : halls.slice(-1);

    for (const hall of candidateHalls) {
      const hallSchedule = hallOccupancy.get(hall.id) || [];
      if (!isSlotAvailable(hallSchedule, preferredTime, endTime)) continue;

      let matchedHost = null;
      let hostMatchReason = '';

      const hostsBySkill: any[] = [];
      for (const host of hosts) {
        const skills = host.skills ? host.skills.split(',') : [];
        const hasPreference = preference && skills.some((s: string) => s.includes(preference));
        hostsBySkill.push({ host, skills, hasPreference });
      }
      hostsBySkill.sort((a, b) => (b.hasPreference ? 1 : 0) - (a.hasPreference ? 1 : 0));

      for (const { host, skills, hasPreference } of hostsBySkill) {
        const hostSchedule = hostOccupancy.get(host.id) || [];
        if (!isSlotAvailable(hostSchedule, preferredTime, endTime)) continue;

        matchedHost = host;
        if (hasPreference) {
          hostMatchReason = `司仪${host.realName}具备"${preference}"相关技能，与家属偏好匹配`;
        } else {
          hostMatchReason = `司仪${host.realName}时间可用，技能：${skills.join('、') || '通用'}`;
        }
        break;
      }

      if (!matchedHost) continue;

      const finalReason = `${allocationReason}；${hostMatchReason}；厅室：${hall.name}(${hall.capacity}人)`;

      ceremonies.push({
        remainsId: remains.id,
        hallId: hall.id,
        hostId: matchedHost.id,
        startTime: preferredTime,
        endTime,
        status: CeremonyStatus.PENDING,
        familyPreference: preference || null,
        allocationReason: finalReason,
      });

      hallSchedule.push({ start: preferredTime, end: endTime });
      hallOccupancy.set(hall.id, hallSchedule);
      const hostSchedule = hostOccupancy.get(matchedHost.id) || [];
      hostSchedule.push({ start: preferredTime, end: endTime });
      hostOccupancy.set(matchedHost.id, hostSchedule);

      allocated = true;
      break;
    }

    if (!allocated) {
      ceremonies.push({
        remainsId: remains.id,
        hallId: '',
        hostId: '',
        startTime: preferredTime,
        endTime,
        status: CeremonyStatus.PENDING,
        familyPreference: preference || null,
        allocationReason: '无可用厅室或司仪，请手动调整',
      });
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

    const validCeremonies = ceremonies.filter((c) => c.hallId && c.hostId);

    if (validCeremonies.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const c of validCeremonies) {
          await tx.ceremony.create({ data: c });
          await tx.remains.update({
            where: { id: c.remainsId },
            data: { status: 'CEREMONY_SCHEDULED' },
          });
        }
      });
    }

    res.json({ count: validCeremonies.length, ceremonies });
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
        remains: { select: { id: true, name: true, familyName: true, familyPhone: true, expectedAttendees: true, ceremonyPreference: true } },
        hall: true,
        host: { select: { id: true, realName: true, phone: true, skills: true } },
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
    const ceremony = await prisma.ceremony.findUnique({
      where: { id: req.params.id },
      include: {
        remains: true,
        hall: true,
        host: true,
      },
    });
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
      include: {
        remains: true,
        hall: true,
        host: true,
      },
    });

    const timeStr = dayjs(ceremony.startTime).format('YYYY-MM-DD HH:mm');
    const template = NotificationTemplates.ceremonyApproved(
      ceremony.remains.name,
      ceremony.hall.name,
      ceremony.host.realName,
      timeStr
    );

    await notifyRole(UserRole.HOST, {
      ...template,
      targetId: ceremony.id,
    });

    await notifyRole(UserRole.RECEPTION, {
      ...template,
      targetId: ceremony.id,
    });

    await notifyRole(UserRole.STAFF, {
      ...template,
      targetId: ceremony.id,
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
