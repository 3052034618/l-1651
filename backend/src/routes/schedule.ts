import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRoles } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { ShiftType, RequestStatus, UserRole } from '../types/enums';
import { notifyRole, notifyUsers, NotificationTemplates } from '../utils/notification';
import dayjs from 'dayjs';

const router = Router();
router.use(authMiddleware);

const SHIFT_HOURS: Record<string, number> = {
  [ShiftType.MORNING]: 8,
  [ShiftType.AFTERNOON]: 8,
  [ShiftType.NIGHT]: 8,
  [ShiftType.DAY_OFF]: 0,
};

const REQUIRED_SKILLS_PER_SHIFT: Record<string, string[]> = {
  [ShiftType.MORNING]: ['HOST', 'CREMATOR', 'RECEPTION'],
  [ShiftType.AFTERNOON]: ['HOST', 'CREMATOR', 'RECEPTION'],
  [ShiftType.NIGHT]: ['HOST', 'CREMATOR', 'RECEPTION'],
};

const roleToSkill = (role: string): string | null => {
  const map: Record<string, string> = {
    [UserRole.HOST]: 'HOST',
    [UserRole.CREMATOR]: 'CREMATOR',
    [UserRole.RECEPTION]: 'RECEPTION',
    [UserRole.STAFF]: 'STAFF',
  };
  return map[role] || null;
};

export const generateWeeklySchedule = async (startDate: Date) => {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.STAFF, UserRole.HOST, UserRole.CREMATOR, UserRole.RECEPTION] },
    },
  });

  if (users.length === 0) return { schedules: [], coverageGaps: [], hostPoolCount: 0, crematorPoolCount: 0, receptionPoolCount: 0 };

  const schedules: any[] = [];
  const weeklyHours = new Map<string, number>();
  users.forEach((u) => weeklyHours.set(u.id, 0));

  const shifts = [ShiftType.MORNING, ShiftType.AFTERNOON, ShiftType.NIGHT];
  const coverageGaps: any[] = [];

  for (let day = 0; day < 7; day++) {
    const date = dayjs(startDate).add(day, 'day').startOf('day').toDate();
    const assignedForDay: Set<string> = new Set();
    const shiftAssignments: Record<string, string[]> = {
      [ShiftType.MORNING]: [],
      [ShiftType.AFTERNOON]: [],
      [ShiftType.NIGHT]: [],
    };
    const skillsCovered: Record<string, Set<string>> = {
      [ShiftType.MORNING]: new Set(),
      [ShiftType.AFTERNOON]: new Set(),
      [ShiftType.NIGHT]: new Set(),
    };

    const sortedUsers = [...users].sort((a, b) => {
      const hoursA = weeklyHours.get(a.id) || 0;
      const hoursB = weeklyHours.get(b.id) || 0;
      return hoursA - hoursB;
    });

    for (const shiftType of shifts) {
      const shiftHours = SHIFT_HOURS[shiftType] || 8;
      const requiredSkills = REQUIRED_SKILLS_PER_SHIFT[shiftType] || [];

      let candidates = sortedUsers.filter((u) => {
        if (assignedForDay.has(u.id)) return false;
        const currentHours = weeklyHours.get(u.id) || 0;
        const maxHours = u.maxWorkHours * 7;
        if (currentHours + shiftHours > maxHours) return false;
        return true;
      });

      const skillUsers: Record<string, typeof users> = {};
      for (const skill of requiredSkills) {
        skillUsers[skill] = candidates.filter((u) => roleToSkill(u.role) === skill);
      }

      for (const skill of requiredSkills) {
        if (skillUsers[skill].length > 0 && !skillsCovered[shiftType].has(skill)) {
          const available = skillUsers[skill].filter((u) => !assignedForDay.has(u.id));
          if (available.length > 0) {
            const user = available[0];
            shiftAssignments[shiftType].push(user.id);
            assignedForDay.add(user.id);
            skillsCovered[shiftType].add(skill);
            const currentHours = weeklyHours.get(user.id) || 0;
            weeklyHours.set(user.id, currentHours + shiftHours);
          }
        }
      }

      for (const skill of requiredSkills) {
        if (!skillsCovered[shiftType].has(skill)) {
          const fallback = candidates.filter((u) => !assignedForDay.has(u.id));
          if (fallback.length > 0) {
            const user = fallback[0];
            shiftAssignments[shiftType].push(user.id);
            assignedForDay.add(user.id);
            const userSkill = roleToSkill(user.role);
            if (userSkill) skillsCovered[shiftType].add(userSkill);
            const currentHours = weeklyHours.get(user.id) || 0;
            weeklyHours.set(user.id, currentHours + shiftHours);
          }
        }
      }

      const minStaff = 2;
      const remainingSlots = minStaff - shiftAssignments[shiftType].length;
      if (remainingSlots > 0) {
        const remainingUsers = candidates.filter((u) => !assignedForDay.has(u.id));
        for (let i = 0; i < Math.min(remainingSlots, remainingUsers.length); i++) {
          const user = remainingUsers[i];
          shiftAssignments[shiftType].push(user.id);
          assignedForDay.add(user.id);
          const userSkill = roleToSkill(user.role);
          if (userSkill) skillsCovered[shiftType].add(userSkill);
          const currentHours = weeklyHours.get(user.id) || 0;
          weeklyHours.set(user.id, currentHours + shiftHours);
        }
      }

      const missingSkills = requiredSkills.filter((s) => !skillsCovered[shiftType].has(s));
      if (missingSkills.length > 0) {
        coverageGaps.push({
          date: dayjs(date).format('YYYY-MM-DD'),
          shift: shiftType,
          missingSkills,
          reason: missingSkills.map((s) => {
            const skillPool = users.filter((u) => roleToSkill(u.role) === s);
            if (skillPool.length === 0) return `${s}：无对应岗位人员`;
            const available = skillPool.filter((u) => {
              if (assignedForDay.has(u.id)) return false;
              const currentHours = weeklyHours.get(u.id) || 0;
              const maxHours = u.maxWorkHours * 7;
              return currentHours + shiftHours <= maxHours;
            });
            if (available.length === 0) {
              const allAssigned = skillPool.every((u) => assignedForDay.has(u.id));
              if (allAssigned) return `${s}：${skillPool.length}人均已分配其他班次`;
              return `${s}：所有${skillPool.length}人均达周工时上限`;
            }
            return `${s}：异常`;
          }).join('；'),
        });
      }
    }

    for (const user of users) {
      if (assignedForDay.has(user.id)) {
        const assignedShift = shifts.find((s) => shiftAssignments[s].includes(user.id));
        if (assignedShift) {
          schedules.push({
            userId: user.id,
            date,
            shiftType: assignedShift,
          });
        }
      } else {
        schedules.push({
          userId: user.id,
          date,
          shiftType: ShiftType.DAY_OFF,
        });
      }
    }
  }

  const schedulesWithHours = schedules.map((s) => ({
    ...s,
    weekHours: weeklyHours.get(s.userId) || 0,
  }));

  return {
    schedules: schedulesWithHours,
    coverageGaps,
    hostPoolCount: users.filter((u) => roleToSkill(u.role) === 'HOST').length,
    crematorPoolCount: users.filter((u) => roleToSkill(u.role) === 'CREMATOR').length,
    receptionPoolCount: users.filter((u) => roleToSkill(u.role) === 'RECEPTION').length,
  };
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

    const { schedules, coverageGaps, hostPoolCount, crematorPoolCount, receptionPoolCount } = await generateWeeklySchedule(startOfWeek);

    const created = await prisma.$transaction(async (tx) => {
      const result: any[] = [];
      for (const s of schedules) {
        const created = await tx.schedule.create({
          data: {
            userId: s.userId,
            date: s.date,
            shiftType: s.shiftType,
          },
          include: { user: { select: { realName: true, role: true, maxWorkHours: true, skills: true } } },
        });
        result.push({ ...created, weekHours: s.weekHours });
      }
      return result;
    });

    const userStats: Record<string, { hours: number; shifts: number }> = {};
    for (const s of schedules) {
      if (!userStats[s.userId]) {
        userStats[s.userId] = { hours: 0, shifts: 0 };
      }
      if (s.shiftType !== ShiftType.DAY_OFF) {
        userStats[s.userId].hours += SHIFT_HOURS[s.shiftType] || 8;
        userStats[s.userId].shifts += 1;
      }
    }

    const dailyCoverageGen: Record<string, any> = {};
    for (let day = 0; day < 7; day++) {
      const dateKey = dayjs(startOfWeek).add(day, 'day').format('YYYY-MM-DD');
      dailyCoverageGen[dateKey] = { MORNING: {}, AFTERNOON: {}, NIGHT: {} };
      for (const shift of ['MORNING', 'AFTERNOON', 'NIGHT']) {
        const gap = coverageGaps.find((g) => g.date === dateKey && g.shift === shift);
        const missing = gap ? gap.missingSkills : [];
        dailyCoverageGen[dateKey][shift] = {
          hasHost: !missing.includes('HOST'),
          hasCremator: !missing.includes('CREMATOR'),
          hasReception: !missing.includes('RECEPTION'),
          allCovered: missing.length === 0,
          missingSkills: missing,
          reason: gap?.reason || '',
        };
      }
    }

    res.json({
      count: created.length,
      schedules: created,
      userStats,
      coverageGaps,
      dailyCoverage: dailyCoverageGen,
      poolStats: { HOST: hostPoolCount, CREMATOR: crematorPoolCount, RECEPTION: receptionPoolCount },
      skillsMap: {
        HOST: '司仪',
        CREMATOR: '火化员',
        RECEPTION: '接待员',
        STAFF: '通用员工',
      },
    });
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
      include: { user: { select: { realName: true, role: true, phone: true, maxWorkHours: true, skills: true } } },
      orderBy: [{ date: 'asc' }, { userId: 'asc' }],
    });

    const userStats: Record<string, { hours: number; shifts: number; maxHours: number; skills: string; role: string; name: string }> = {};
    for (const s of schedules) {
      if (!userStats[s.userId]) {
        userStats[s.userId] = {
          hours: 0,
          shifts: 0,
          maxHours: (s.user as any).maxWorkHours ? (s.user as any).maxWorkHours * 7 : 56,
          skills: (s.user as any).skills || '',
          role: (s.user as any).role || '',
          name: (s.user as any).realName || '',
        };
      }
      if (s.shiftType !== ShiftType.DAY_OFF) {
        userStats[s.userId].hours += SHIFT_HOURS[s.shiftType] || 8;
        userStats[s.userId].shifts += 1;
      }
    }

    const dailyCoverage: Record<string, Record<string, Set<string>>> = {};
    for (const s of schedules) {
      const dateKey = dayjs(s.date).format('YYYY-MM-DD');
      if (!dailyCoverage[dateKey]) {
        dailyCoverage[dateKey] = { MORNING: new Set(), AFTERNOON: new Set(), NIGHT: new Set() };
      }
      if (s.shiftType !== ShiftType.DAY_OFF) {
        const skill = roleToSkill((s.user as any).role);
        if (skill) {
          dailyCoverage[dateKey][s.shiftType].add(skill);
        }
      }
    }

    const dailyCoveragePlain: Record<string, any> = {};
    const coverageGapsList: any[] = [];
    for (const [date, shifts] of Object.entries(dailyCoverage)) {
      dailyCoveragePlain[date] = {};
      for (const [shift, skills] of Object.entries(shifts)) {
        const missing: string[] = [];
        for (const req of ['HOST', 'CREMATOR', 'RECEPTION']) {
          if (!skills.has(req)) missing.push(req);
        }
        dailyCoveragePlain[date][shift] = {
          skills: Array.from(skills),
          hasHost: skills.has('HOST'),
          hasCremator: skills.has('CREMATOR'),
          hasReception: skills.has('RECEPTION'),
          allCovered: missing.length === 0,
          missingSkills: missing,
        };
        if (missing.length > 0) {
          const gapReasons: string[] = [];
          for (const m of missing) {
            const missingPool = schedules
              .filter((s) => dayjs(s.date).format('YYYY-MM-DD') === date && roleToSkill((s.user as any).role) === m)
              .map((s) => s.userId);
            const uniquePool = Array.from(new Set(missingPool));
            if (uniquePool.length === 0) {
              gapReasons.push(`${m}：无对应岗位人员`);
            } else {
              const assignedThatDay = schedules.filter(
                (s) => dayjs(s.date).format('YYYY-MM-DD') === date &&
                  uniquePool.includes(s.userId) &&
                  s.shiftType !== ShiftType.DAY_OFF &&
                  s.shiftType !== shift
              );
              if (assignedThatDay.length >= uniquePool.length) {
                gapReasons.push(`${m}：${uniquePool.length}人均已分配其他班次`);
              } else {
                const onOff = schedules.filter(
                  (s) => dayjs(s.date).format('YYYY-MM-DD') === date &&
                    uniquePool.includes(s.userId) &&
                    s.shiftType === ShiftType.DAY_OFF
                );
                if (onOff.length > 0) {
                  gapReasons.push(`${m}：${onOff.length}人休息`);
                } else {
                  gapReasons.push(`${m}：工时不足或缺席`);
                }
              }
            }
          }
          coverageGapsList.push({
            date,
            shift,
            missingSkills: missing,
            reason: gapReasons.join('；'),
          });
        }
      }
    }

    const allUsers = await prisma.user.findMany({
      where: { role: { in: [UserRole.STAFF, UserRole.HOST, UserRole.CREMATOR, UserRole.RECEPTION] } },
      select: { role: true },
    });

    res.json({
      schedules,
      userStats,
      dailyCoverage: dailyCoveragePlain,
      coverageGaps: coverageGapsList,
      poolStats: {
        HOST: allUsers.filter((u) => u.role === UserRole.HOST).length,
        CREMATOR: allUsers.filter((u) => u.role === UserRole.CREMATOR).length,
        RECEPTION: allUsers.filter((u) => u.role === UserRole.RECEPTION).length,
      },
      skillsMap: {
        HOST: '司仪',
        CREMATOR: '火化员',
        RECEPTION: '接待员',
        STAFF: '通用员工',
      },
    });
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
  body('targetUserId').optional().isString(),
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
      include: { user: true },
    });

    const template = NotificationTemplates.shiftRequest(request.user.realName, request.reason);
    await notifyRole(UserRole.ADMIN, {
      ...template,
      targetId: request.id,
    });
    await notifyRole(UserRole.SUPERVISOR, {
      ...template,
      targetId: request.id,
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
      include: { user: { select: { realName: true, phone: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.post('/shift-requests/:id/approve', requireRoles(UserRole.ADMIN, UserRole.SUPERVISOR), async (req: AuthRequest, res, next) => {
  try {
    const shiftRequest = await prisma.shiftRequest.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!shiftRequest) throw new AppError('调班申请不存在', 404);
    if (shiftRequest.status !== RequestStatus.PENDING) {
      throw new AppError('仅待审批状态可审批', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.shiftRequest.update({
        where: { id: req.params.id },
        data: {
          status: RequestStatus.APPROVED,
          approvedBy: req.user!.id,
          approvedAt: new Date(),
        },
      });

      const originalDate = dayjs(shiftRequest.originalDate).startOf('day').toDate();
      const requestedDate = dayjs(shiftRequest.requestedDate).startOf('day').toDate();

      const originalSchedule = await tx.schedule.findUnique({
        where: {
          userId_date: {
            userId: shiftRequest.userId,
            date: originalDate,
          },
        },
      });

      if (originalSchedule) {
        await tx.schedule.update({
          where: {
            userId_date: {
              userId: shiftRequest.userId,
              date: originalDate,
            },
          },
          data: { shiftType: ShiftType.DAY_OFF },
        });
      } else {
        await tx.schedule.create({
          data: {
            userId: shiftRequest.userId,
            date: originalDate,
            shiftType: ShiftType.DAY_OFF,
          },
        });
      }

      const requestedSchedule = await tx.schedule.findUnique({
        where: {
          userId_date: {
            userId: shiftRequest.userId,
            date: requestedDate,
          },
        },
      });

      if (requestedSchedule) {
        await tx.schedule.update({
          where: {
            userId_date: {
              userId: shiftRequest.userId,
              date: requestedDate,
            },
          },
          data: { shiftType: shiftRequest.requestedShift },
        });
      } else {
        await tx.schedule.create({
          data: {
            userId: shiftRequest.userId,
            date: requestedDate,
            shiftType: shiftRequest.requestedShift,
          },
        });
      }

      if (shiftRequest.targetUserId) {
        const targetOriginalSchedule = await tx.schedule.findUnique({
          where: {
            userId_date: {
              userId: shiftRequest.targetUserId,
              date: requestedDate,
            },
          },
        });
        if (targetOriginalSchedule) {
          await tx.schedule.update({
            where: {
              userId_date: {
                userId: shiftRequest.targetUserId,
                date: requestedDate,
              },
            },
            data: { shiftType: ShiftType.DAY_OFF },
          });
        }

        const targetRequestedSchedule = await tx.schedule.findUnique({
          where: {
            userId_date: {
              userId: shiftRequest.targetUserId,
              date: originalDate,
            },
          },
        });
        if (targetRequestedSchedule) {
          await tx.schedule.update({
            where: {
              userId_date: {
                userId: shiftRequest.targetUserId,
                date: originalDate,
              },
            },
            data: { shiftType: shiftRequest.originalShift },
          });
        } else {
          await tx.schedule.create({
            data: {
              userId: shiftRequest.targetUserId,
              date: originalDate,
              shiftType: shiftRequest.originalShift,
            },
          });
        }
      }
    });

    const originalDateStr = dayjs(shiftRequest.originalDate).format('MM-DD') + ' ' + shiftRequest.originalShift;
    const requestedDateStr = dayjs(shiftRequest.requestedDate).format('MM-DD') + ' ' + shiftRequest.requestedShift;
    const template = NotificationTemplates.shiftApproved(originalDateStr, requestedDateStr);
    await notifyUsers([shiftRequest.userId], {
      ...template,
      targetId: shiftRequest.id,
    });

    res.json({ message: '调班申请已批准，排班已同步更新' });
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
