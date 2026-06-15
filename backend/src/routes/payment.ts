import { Router } from 'express';
import { body } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { PaymentMethod, PaymentStatus, FeeCategory } from '../types/enums';
import dayjs from 'dayjs';

const router = Router();
router.use(authMiddleware);

export const calculateFees = async (remainsId: string) => {
  const remains = await prisma.remains.findUnique({
    where: { id: remainsId },
    include: {
      cabinet: true,
      ceremony: { include: { hall: true } },
      cremation: { include: { furnace: true } },
      ashes: { include: { niche: true } },
    },
  });
  if (!remains) throw new AppError('遗体记录不存在', 404);

  const feeItems = await prisma.feeItem.findMany({ where: { isActive: true } });
  const records: any[] = [];

  const getItem = (category: FeeCategory, nameKeyword: string) =>
    feeItems.find((f) => f.category === category && f.name.includes(nameKeyword));

  const transportFee = getItem(FeeCategory.TRANSPORT, '市内');
  if (transportFee) {
    records.push({
      feeItemId: transportFee.id,
      quantity: 1,
      unitPrice: transportFee.price,
      subtotal: transportFee.price,
    });
  }

  const storageDays = Math.max(
    1,
    Math.ceil((Date.now() - remains.createdAt.getTime()) / (1000 * 60 * 60 * 24))
  );
  const storageType = remains.storageRequirement;
  const storageName = storageType === 'LOW_TEMP' ? '低温' : storageType === 'SPECIAL' ? '特殊' : '普通';
  const storageFee = getItem(FeeCategory.STORAGE, storageName);
  if (storageFee) {
    records.push({
      feeItemId: storageFee.id,
      quantity: storageDays,
      unitPrice: storageFee.price,
      subtotal: storageFee.price * storageDays,
    });
  }

  const disinfectFee = getItem(FeeCategory.OTHER, '消毒');
  if (disinfectFee) {
    records.push({
      feeItemId: disinfectFee.id,
      quantity: 1,
      unitPrice: disinfectFee.price,
      subtotal: disinfectFee.price,
    });
  }

  if (remains.ceremony) {
    const hallNo = remains.ceremony.hall.hallNo;
    const hallFee = getItem(FeeCategory.CEREMONY, hallNo === 'H01' ? '一号' : hallNo === 'H02' ? '二号' : hallNo === 'H03' ? '三号' : '四号');
    if (hallFee) {
      records.push({
        feeItemId: hallFee.id,
        quantity: 1,
        unitPrice: hallFee.price,
        subtotal: hallFee.price,
      });
    }
    const hostFee = getItem(FeeCategory.CEREMONY, '司仪');
    if (hostFee) {
      records.push({
        feeItemId: hostFee.id,
        quantity: 1,
        unitPrice: hostFee.price,
        subtotal: hostFee.price,
      });
    }
  }

  if (remains.cremation) {
    const furnaceType = remains.cremation.furnace.type;
    const cremationName = furnaceType === 'TYPE_A' ? 'A型' : furnaceType === 'TYPE_B' ? 'B型' : 'C型';
    const cremationFee = getItem(FeeCategory.CREMATION, cremationName);
    if (cremationFee) {
      records.push({
        feeItemId: cremationFee.id,
        quantity: 1,
        unitPrice: cremationFee.price,
        subtotal: cremationFee.price,
      });
    }
  }

  if (remains.ashes) {
    const nicheLevel = remains.ashes.niche.level;
    const nicheName = nicheLevel === 'NORMAL' ? '普通' : nicheLevel === 'DELUXE' ? '豪华' : '尊享';
    const nicheFee = getItem(FeeCategory.NICHE_STORAGE, nicheName);
    if (nicheFee) {
      records.push({
        feeItemId: nicheFee.id,
        quantity: 1,
        unitPrice: nicheFee.price,
        subtotal: nicheFee.price,
      });
    }
  }

  return records;
};

router.post('/calculate/:remainsId', async (req, res, next) => {
  try {
    const records = await calculateFees(req.params.remainsId);
    const total = records.reduce((sum, r) => sum + r.subtotal, 0);
    res.json({ records, total });
  } catch (error) {
    next(error);
  }
});

router.post('/generate/:remainsId', async (req: any, res, next) => {
  try {
    const remainsId = req.params.remainsId;
    const remains = await prisma.remains.findUnique({ where: { id: remainsId } });
    if (!remains) throw new AppError('遗体记录不存在', 404);

    const records = await calculateFees(remainsId);
    const total = records.reduce((sum, r) => sum + r.subtotal, 0);

    const result = await prisma.$transaction(async (tx) => {
      await tx.feeRecord.deleteMany({ where: { remainsId } });

      const createdRecords = await Promise.all(
        records.map((r) =>
          tx.feeRecord.create({
            data: { ...r, remainsId },
            include: { feeItem: true },
          })
        )
      );

      const payment = await tx.payment.upsert({
        where: { remainsId },
        update: { totalAmount: total },
        create: { remainsId, totalAmount: total },
        include: { records: { include: { feeItem: true } } },
      });

      return { payment, records: createdRecords };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/payments', [
  body('status').optional(),
  validateRequest,
], async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.status) where.paymentStatus = req.query.status;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        records: { include: { feeItem: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

router.get('/payments/:remainsId', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { remainsId: req.params.remainsId },
      include: {
        records: { include: { feeItem: true } },
      },
    });
    if (!payment) throw new AppError('支付记录不存在', 404);
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

router.post('/pay/:remainsId', [
  body('amount').isFloat({ min: 0.01 }).withMessage('支付金额必须大于0'),
  body('paymentMethod').isIn(['CASH', 'CARD', 'ALIPAY', 'WECHAT', 'TRANSFER']).withMessage('支付方式无效'),
  validateRequest,
], async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    const payment = await prisma.payment.findUnique({ where: { remainsId: req.params.remainsId } });
    if (!payment) throw new AppError('支付记录不存在', 404);

    const paidAmount = payment.paidAmount + amount;
    let status = payment.paymentStatus;

    if (paidAmount >= payment.totalAmount) {
      status = PaymentStatus.PAID;
    } else if (paidAmount > 0) {
      status = PaymentStatus.PARTIAL_PAID;
    }

    const updated = await prisma.payment.update({
      where: { remainsId: req.params.remainsId },
      data: {
        paidAmount,
        paymentStatus: status,
        paymentMethod,
        paidAt: status === PaymentStatus.PAID ? new Date() : payment.paidAt,
      },
      include: { records: { include: { feeItem: true } } },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/overdue/payments', async (req, res, next) => {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const overduePayments = await prisma.payment.findMany({
      where: {
        createdAt: { lt: threshold },
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL_PAID] },
      },
      include: {
        records: { include: { feeItem: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      overduePayments.map((p) => ({
        ...p,
        overdueAmount: p.totalAmount - p.paidAmount,
        overdueDays: Math.floor((now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get('/fee-items', async (req, res, next) => {
  try {
    const items = await prisma.feeItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

export default router;
