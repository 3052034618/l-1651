import { Router } from 'express';
import { query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { FeeCategory, RemainsStatus } from '../types/enums';
import dayjs from 'dayjs';

const router = Router();
router.use(authMiddleware);

router.get('/overview', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = dayjs(now).startOf('day').toDate();
    const endOfDay = dayjs(now).endOf('day').toDate();
    const startOfMonth = dayjs(now).startOf('month').toDate();
    const endOfMonth = dayjs(now).endOf('month').toDate();

    const [
      todayRemains,
      todayCeremonies,
      todayCremations,
      monthRevenue,
      remainsByStatus,
      cabinetStats,
      nicheStats,
    ] = await Promise.all([
      prisma.remains.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.ceremony.count({ where: { startTime: { gte: startOfDay, lte: endOfDay } } }),
      prisma.cremation.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: startOfMonth, lte: endOfMonth }, paymentStatus: 'PAID' },
        _sum: { paidAmount: true },
      }),
      prisma.remains.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.storageCabinet.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.ashesNiche.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    res.json({
      today: {
        remains: todayRemains,
        ceremonies: todayCeremonies,
        cremations: todayCremations,
      },
      monthRevenue: monthRevenue._sum.paidAmount || 0,
      remainsByStatus: remainsByStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      cabinetStats,
      nicheStats,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/service-statistics', [
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  query('groupBy').optional().isIn(['day', 'week', 'month']),
  validateRequest,
], async (req, res, next) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : dayjs().subtract(30, 'day').toDate();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const groupBy = (req.query.groupBy as string) || 'day';

    const remains = await prisma.remains.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    });

    const ceremonies = await prisma.ceremony.findMany({
      where: { startTime: { gte: startDate, lte: endDate } },
      select: { startTime: true },
    });

    const cremations = await prisma.cremation.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    });

    const ashesStored = await prisma.ashes.findMany({
      where: { storageStart: { gte: startDate, lte: endDate } },
      select: { storageStart: true },
    });

    const groupData = (items: any[], dateField: string) => {
      const grouped: Record<string, number> = {};
      for (const item of items) {
        let key: string;
        const date = dayjs(item[dateField as keyof typeof item] as Date);
        if (groupBy === 'day') {
          key = date.format('YYYY-MM-DD');
        } else if (groupBy === 'week') {
          key = date.startOf('week').format('YYYY-MM-DD');
        } else {
          key = date.format('YYYY-MM');
        }
        grouped[key] = (grouped[key] || 0) + 1;
      }
      return grouped;
    };

    res.json({
      total: {
        remains: remains.length,
        ceremonies: ceremonies.length,
        cremations: cremations.length,
        ashesStored: ashesStored.length,
      },
      byDate: {
        remains: groupData(remains, 'createdAt'),
        ceremonies: groupData(ceremonies, 'startTime'),
        cremations: groupData(cremations, 'createdAt'),
        ashesStored: groupData(ashesStored, 'storageStart'),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/revenue-statistics', [
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : dayjs().subtract(30, 'day').toDate();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'PAID' },
      include: {
        records: { include: { feeItem: true } },
      },
    });

    const byCategory: Record<string, number> = {};
    let total = 0;

    for (const payment of payments) {
      total += payment.paidAmount;
      for (const record of payment.records) {
        const category = record.feeItem.category;
        byCategory[category] = (byCategory[category] || 0) + record.subtotal;
      }
    }

    res.json({
      total,
      byCategory,
      paymentCount: payments.length,
      averagePayment: payments.length > 0 ? total / payments.length : 0,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/equipment-utilization', [
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : dayjs().subtract(30, 'day').toDate();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const furnaces = await prisma.cremationFurnace.findMany({
      include: {
        cremations: {
          where: { createdAt: { gte: startDate, lte: endDate } },
        },
      },
    });

    const halls = await prisma.ceremonyHall.findMany({
      include: {
        ceremonies: {
          where: { startTime: { gte: startDate, lte: endDate } },
        },
      },
    });

    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    res.json({
      furnaces: furnaces.map((f) => ({
        furnaceNo: f.furnaceNo,
        type: f.type,
        usageCount: f.cremations.length,
        utilizationRate: ((f.cremations.length / Math.max(1, daysDiff * 3)) * 100).toFixed(2),
        currentFuelLevel: f.fuelLevel,
      })),
      halls: halls.map((h) => ({
        hallNo: h.hallNo,
        name: h.name,
        capacity: h.capacity,
        usageCount: h.ceremonies.length,
        utilizationRate: ((h.ceremonies.length / Math.max(1, daysDiff * 4)) * 100).toFixed(2),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/monthly-report', [
  query('year').optional().isInt(),
  query('month').optional().isInt(),
  validateRequest,
], async (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const [
      remains,
      ceremonies,
      cremations,
      ashes,
      payments,
    ] = await Promise.all([
      prisma.remains.findMany({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        select: { id: true, name: true, status: true, createdAt: true },
      }),
      prisma.ceremony.findMany({
        where: { startTime: { gte: startOfMonth, lte: endOfMonth } },
        include: { remains: { select: { name: true } }, hall: true, host: { select: { realName: true } } },
      }),
      prisma.cremation.findMany({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        include: { remains: { select: { name: true } }, furnace: true },
      }),
      prisma.ashes.findMany({
        where: { storageStart: { gte: startOfMonth, lte: endOfMonth } },
        include: { remains: { select: { name: true } }, niche: true },
      }),
      prisma.payment.findMany({
        where: { paidAt: { gte: startOfMonth, lte: endOfMonth } },
        include: { records: { include: { feeItem: true } } },
      }),
    ]);

    let totalRevenue = 0;
    const revenueByCategory: Record<string, number> = {};
    for (const p of payments) {
      totalRevenue += p.paidAmount;
      for (const r of p.records) {
        const cat = r.feeItem.category;
        revenueByCategory[cat] = (revenueByCategory[cat] || 0) + r.subtotal;
      }
    }

    res.json({
      period: { year, month },
      summary: {
        remainsCount: remains.length,
        ceremoniesCount: ceremonies.length,
        cremationsCount: cremations.length,
        ashesStoredCount: ashes.length,
        totalRevenue,
        paymentCount: payments.length,
      },
      revenueByCategory,
      remains,
      ceremonies,
      cremations,
      ashes,
      generatedAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
