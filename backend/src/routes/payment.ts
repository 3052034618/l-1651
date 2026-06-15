import { Router } from 'express';
import { body, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { PaymentMethod, PaymentStatus, FeeCategory } from '../types/enums';
import { notifyRole, NotificationTemplates } from '../utils/notification';
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
      category: FeeCategory.TRANSPORT,
      itemName: transportFee.name,
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
      category: FeeCategory.STORAGE,
      itemName: `${storageName}冷藏(共${storageDays}天)`,
    });
  }

  const disinfectFee = getItem(FeeCategory.OTHER, '消毒');
  if (disinfectFee) {
    records.push({
      feeItemId: disinfectFee.id,
      quantity: 1,
      unitPrice: disinfectFee.price,
      subtotal: disinfectFee.price,
      category: FeeCategory.OTHER,
      itemName: disinfectFee.name,
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
        category: FeeCategory.CEREMONY,
        itemName: `${remains.ceremony.hall.name}厅使用费`,
      });
    }
    const hostFee = getItem(FeeCategory.CEREMONY, '司仪');
    if (hostFee) {
      records.push({
        feeItemId: hostFee.id,
        quantity: 1,
        unitPrice: hostFee.price,
        subtotal: hostFee.price,
        category: FeeCategory.CEREMONY,
        itemName: '司仪服务费',
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
        category: FeeCategory.CREMATION,
        itemName: `${cremationName}炉火化费`,
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
        category: FeeCategory.NICHE_STORAGE,
        itemName: `${nicheName}格位寄存费`,
      });
    }
  }

  return records;
};

router.get('/remains-to-bill', [
  query('status').optional().isString(),
  query('keyword').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.status) {
      where.status = req.query.status as string;
    }
    if (req.query.keyword) {
      where.OR = [
        { name: { contains: req.query.keyword as string } },
        { idCardNumber: { contains: req.query.keyword as string } },
        { familyName: { contains: req.query.keyword as string } },
      ];
    }

    const remainsList = await prisma.remains.findMany({
      where,
      include: {
        cabinet: true,
        ceremony: { include: { hall: true } },
        cremation: { include: { furnace: true } },
        ashes: { include: { niche: true } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const result = remainsList.map((r: any) => ({
      id: r.id,
      name: r.name,
      idCardNumber: r.idCardNumber,
      familyName: r.familyName,
      familyPhone: r.familyPhone,
      status: r.status,
      storageRequirement: r.storageRequirement,
      hasCeremony: !!r.ceremony,
      hasCremation: !!r.cremation,
      hasAshes: !!r.ashes,
      hasPayment: !!r.payment,
      paymentStatus: r.payment?.paymentStatus || null,
      createdAt: r.createdAt,
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/calculate/:remainsId', async (req, res, next) => {
  try {
    const records = await calculateFees(req.params.remainsId);
    const total = records.reduce((sum, r) => sum + r.subtotal, 0);
    const remains = await prisma.remains.findUnique({
      where: { id: req.params.remainsId },
      select: { name: true, familyName: true },
    });
    res.json({
      remains,
      records,
      total,
      categorySummary: records.reduce((acc: any, r: any) => {
        if (!acc[r.category]) acc[r.category] = 0;
        acc[r.category] += r.subtotal;
        return acc;
      }, {}),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/generate-bill/:remainsId', async (req: AuthRequest, res, next) => {
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
            data: {
              feeItemId: r.feeItemId,
              quantity: r.quantity,
              unitPrice: r.unitPrice,
              subtotal: r.subtotal,
              remainsId,
            },
            include: { feeItem: true },
          })
        )
      );

      const payment = await tx.payment.upsert({
        where: { remainsId },
        update: {
          totalAmount: total,
          records: { connect: createdRecords.map((r) => ({ id: r.id })) },
        },
        create: {
          remainsId,
          totalAmount: total,
          records: { connect: createdRecords.map((r) => ({ id: r.id })) },
        },
        include: {
          records: { include: { feeItem: true } },
        },
      });

      return { payment, records: createdRecords };
    });

    res.json({
      message: '账单生成成功',
      ...result,
      total,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/payments', [
  query('status').optional(),
  query('keyword').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.status) where.paymentStatus = req.query.status;
    if (req.query.keyword) {
      where.remains = {
        OR: [
          { name: { contains: req.query.keyword as string } },
          { familyName: { contains: req.query.keyword as string } },
        ],
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        records: { include: { feeItem: true } },
        remains: { select: { name: true, familyName: true, familyPhone: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
        remains: { select: { name: true, familyName: true } },
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
  body('transactionId').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const { amount, paymentMethod, transactionId } = req.body;
    const remainsId = req.params.remainsId;

    const payment = await prisma.payment.findUnique({
      where: { remainsId },
      include: { remains: true },
    });
    if (!payment) throw new AppError('支付记录不存在', 404);

    const paidAmount = payment.paidAmount + amount;
    let status = payment.paymentStatus;

    if (paidAmount >= payment.totalAmount) {
      status = PaymentStatus.PAID;
    } else if (paidAmount > 0) {
      status = PaymentStatus.PARTIAL_PAID;
    }

    const updated = await prisma.payment.update({
      where: { remainsId },
      data: {
        paidAmount,
        paymentStatus: status,
        paymentMethod,
        transactionId: transactionId || payment.transactionId,
        paidAt: status === PaymentStatus.PAID ? new Date() : payment.paidAt,
      },
      include: {
        records: { include: { feeItem: true } },
        remains: { select: { name: true, familyName: true } },
      },
    });

    if (status === PaymentStatus.PAID) {
      const template = NotificationTemplates.paymentReminder(payment.remains.name, payment.totalAmount);
      template.title = '费用已结清';
      template.content = `【${payment.remains.name}】费用已全部结清，合计¥${payment.totalAmount.toFixed(2)}`;
      await notifyRole('ADMIN', {
        ...template,
        targetId: payment.id,
      });
    }

    res.json({
      message: '支付成功',
      payment: updated,
      remaining: Math.max(0, updated.totalAmount - updated.paidAmount),
    });
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
        remains: { select: { name: true, familyName: true, familyPhone: true } },
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
