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

const PREFERENCE_SKILL_MAP: Record<string, string> = {
  SIMPLE: '简约仪式',
  TRADITIONAL: '传统仪式',
  BUDDHIST: '佛教仪式',
  CHRISTIAN: '基督教仪式',
  CUSTOM: '个性化定制',
};

const PREFERENCE_LABEL_MAP: Record<string, string> = {
  SIMPLE: '简约',
  TRADITIONAL: '传统',
  BUDDHIST: '佛教',
  CHRISTIAN: '基督教',
  CUSTOM: '个性化',
};

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
  const unmatchedDetails: any[] = [];

  const hostSkillsMap = new Map<string, string[]>();
  for (const host of hosts) {
    hostSkillsMap.set(host.id, host.skills ? host.skills.split(',').filter(Boolean) : []);
  }

  for (const remains of remainsList) {
    const existing = await prisma.ceremony.findUnique({ where: { remainsId: remains.id } });
    if (existing) continue;

    const preferredTime = remains.expectedCeremonyTime!;
    const durationMinutes = 60;
    const endTime = new Date(preferredTime.getTime() + durationMinutes * 60 * 1000);
    const attendees = remains.expectedAttendees || 50;
    const preference = remains.ceremonyPreference || '';
    const prefLabel = preference ? (PREFERENCE_LABEL_MAP[preference] || preference) : '无偏好';
    const prefSkill = preference ? (PREFERENCE_SKILL_MAP[preference] || '') : '';

    const suitableHalls = halls.filter((h) => h.capacity >= attendees);
    const hallReason = suitableHalls.length === 0
      ? `无容量≥${attendees}人的厅室，最大容量${halls[halls.length - 1]?.capacity || 0}人`
      : `按预计${attendees}人匹配容量≥${attendees}的厅室（共${suitableHalls.length}间）`;
    const candidateHalls = suitableHalls.length > 0 ? suitableHalls : halls.slice(-1);

    const preferredHosts = hosts.filter((h) => {
      const skills = hostSkillsMap.get(h.id) || [];
      if (!prefSkill) return true;
      return skills.some((s: string) => s.includes(prefSkill) || s.includes(prefLabel));
    });

    let finalReason = '';
    let allocatedHall: any = null;
    let allocatedHost: any = null;

    for (const hall of candidateHalls) {
      const hallSchedule = hallOccupancy.get(hall.id) || [];
      if (!isSlotAvailable(hallSchedule, preferredTime, endTime)) continue;

      const hostCandidates = preferredHosts.length > 0 ? preferredHosts : hosts;
      for (const host of hostCandidates) {
        const hostSchedule = hostOccupancy.get(host.id) || [];
        if (!isSlotAvailable(hostSchedule, preferredTime, endTime)) continue;

        allocatedHall = hall;
        allocatedHost = host;
        break;
      }
      if (allocatedHost) break;
    }

    if (allocatedHall && allocatedHost) {
      const hostSkills = hostSkillsMap.get(allocatedHost.id) || [];
      const matchedByPreference = preference && (
        hostSkills.some((s: string) => s.includes(prefSkill) || s.includes(prefLabel))
      );
      const hostMatchText = matchedByPreference
        ? `✅ 司仪${allocatedHost.realName}技能【${hostSkills.join('、') || '通用'}】与家属偏好"${prefLabel}"匹配`
        : preference && preferredHosts.length === 0
          ? `⚠️ 无具备"${prefLabel}"资质司仪，已分配${allocatedHost.realName}（技能：${hostSkills.join('、') || '通用'}）`
          : preference
            ? `⚠️ ${preferredHosts.length}位具备"${prefLabel}"资质司仪均时间冲突，已分配${allocatedHost.realName}（技能：${hostSkills.join('、') || '通用'}）`
            : `司仪${allocatedHost.realName}时间可用（技能：${hostSkills.join('、') || '通用'}）`;

      finalReason = `${hallReason}；厅室：${allocatedHall.name}(${allocatedHall.capacity}人)；${hostMatchText}`;

      ceremonies.push({
        remainsId: remains.id,
        hallId: allocatedHall.id,
        hostId: allocatedHost.id,
        startTime: preferredTime,
        endTime,
        status: CeremonyStatus.PENDING,
        familyPreference: preference || null,
        allocationReason: finalReason,
        hostSkills: hostSkills,
        preferenceMatched: !!matchedByPreference,
      });

      const hSched = hallOccupancy.get(allocatedHall.id) || [];
      hSched.push({ start: preferredTime, end: endTime });
      hallOccupancy.set(allocatedHall.id, hSched);
      const hostSched = hostOccupancy.get(allocatedHost.id) || [];
      hostSched.push({ start: preferredTime, end: endTime });
      hostOccupancy.set(allocatedHost.id, hostSched);
    } else {
      const reasons: string[] = [];
      const availHalls = candidateHalls.filter((h) =>
        isSlotAvailable(hallOccupancy.get(h.id) || [], preferredTime, endTime)
      );
      if (availHalls.length === 0) {
        reasons.push(`厅室：${candidateHalls.length}间候选厅${dayjs(preferredTime).format('HH:mm')}均被占用`);
      } else {
        reasons.push(`厅室：${availHalls.length}间可用`);
      }

      if (preference) {
        if (preferredHosts.length === 0) {
          reasons.push(`司仪：共${hosts.length}位司仪，无具备"${prefLabel}"资质人员，请调整偏好或人工分配`);
        } else {
          const conflictHosts = preferredHosts.filter((h) =>
            !isSlotAvailable(hostOccupancy.get(h.id) || [], preferredTime, endTime)
          );
          if (conflictHosts.length === preferredHosts.length) {
            reasons.push(`司仪：${preferredHosts.length}位具备"${prefLabel}"资质司仪时间均冲突`);
          } else {
            const availHosts = preferredHosts.filter((h) =>
              isSlotAvailable(hostOccupancy.get(h.id) || [], preferredTime, endTime)
            );
            reasons.push(`司仪：${availHosts.length}位具备"${prefLabel}"资质但未匹配（异常）`);
          }
        }
      } else {
        const availHosts = hosts.filter((h) =>
          isSlotAvailable(hostOccupancy.get(h.id) || [], preferredTime, endTime)
        );
        if (availHosts.length === 0) {
          reasons.push(`司仪：全部${hosts.length}位司仪该时段均被占用`);
        } else {
          reasons.push(`司仪：${availHosts.length}位可用但未匹配（异常）`);
        }
      }

      finalReason = `❌ 未排成功：${reasons.join('；')}`;
      ceremonies.push({
        remainsId: remains.id,
        hallId: '',
        hostId: '',
        startTime: preferredTime,
        endTime,
        status: CeremonyStatus.PENDING,
        familyPreference: preference || null,
        allocationReason: finalReason,
        hostSkills: [],
        preferenceMatched: false,
      });
      unmatchedDetails.push({
        remainsName: remains.name,
        preference: prefLabel,
        time: dayjs(preferredTime).format('HH:mm'),
        reason: finalReason,
      });
    }
  }

  return { ceremonies, unmatchedDetails };
};

router.post('/generate-schedule', [
  body('date').notEmpty().withMessage('日期不能为空'),
  validateRequest,
], async (req: AuthRequest, res, next) => {
  try {
    const date = new Date(req.body.date);
    const { ceremonies, unmatchedDetails } = await generateDailySchedule(date);

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

    res.json({
      count: validCeremonies.length,
      total: ceremonies.length,
      unmatchedCount: unmatchedDetails.length,
      unmatchedDetails,
      ceremonies,
    });
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
        host: { select: { id: true, realName: true, phone: true, skills: true, role: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    const enriched = ceremonies.map((c: any) => ({
      ...c,
      hostSkills: c.host?.skills ? c.host.skills.split(',').filter(Boolean) : [],
      preferenceMatched: !c.remains?.ceremonyPreference || !c.host?.skills
        ? false
        : c.host.skills.includes(c.remains.ceremonyPreference) ||
          c.host.skills.includes(PREFERENCE_SKILL_MAP[c.remains.ceremonyPreference as string] || '') ||
          c.host.skills.includes(PREFERENCE_LABEL_MAP[c.remains.ceremonyPreference as string] || ''),
    }));
    res.json(enriched);
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
