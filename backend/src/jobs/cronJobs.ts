import cron from 'node-cron';
import prisma from '../lib/prisma';
import { OVERDUE_HOURS } from '../config';
import { RemainsStatus, NotificationType, PaymentStatus } from '../types/enums';
import dayjs from 'dayjs';

export const checkOverdueRemains = async () => {
  console.log('[定时任务] 开始扫描超期未处理遗体...');

  const now = new Date();
  const threshold = new Date(now.getTime() - OVERDUE_HOURS * 60 * 60 * 1000);

  const overdueRemains = await prisma.remains.findMany({
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
  });

  for (const remains of overdueRemains) {
    const overdueHours = Math.floor((now.getTime() - remains.createdAt.getTime()) / (1000 * 60 * 60));

    const existingNotification = await prisma.notification.findFirst({
      where: {
        type: NotificationType.OVERDUE_REMINDER,
        targetId: remains.id,
        createdAt: {
          gte: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        },
      },
    });

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          type: NotificationType.OVERDUE_REMINDER,
          title: '遗体保存超期提醒',
          content: `遗体【${remains.name}】已保存超过${overdueHours}小时，请尽快处理后续流程（告别/火化）。家属联系电话：${remains.familyPhone}`,
          targetId: remains.id,
        },
      });
      console.log(`[超期提醒] 遗体 ${remains.name} (ID: ${remains.id}) 已超期 ${overdueHours} 小时，已发送提醒`);
    }
  }

  console.log(`[定时任务] 超期遗体扫描完成，共发现 ${overdueRemains.length} 条超期记录`);
};

export const checkOverduePayments = async () => {
  console.log('[定时任务] 开始扫描欠费记录...');

  const now = new Date();
  const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const overduePayments = await prisma.payment.findMany({
    where: {
      createdAt: { lt: threshold },
      paymentStatus: {
        in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL_PAID],
      },
    },
  });

  for (const payment of overduePayments) {
    const overdueAmount = payment.totalAmount - payment.paidAmount;
    const existingNotification = await prisma.notification.findFirst({
      where: {
        type: NotificationType.PAYMENT_REMINDER,
        targetId: payment.remainsId,
        createdAt: {
          gte: new Date(now.getTime() - 8 * 60 * 60 * 1000),
        },
      },
    });

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          type: NotificationType.PAYMENT_REMINDER,
          title: '费用催缴通知',
          content: `存在欠费记录，欠费金额：¥${overdueAmount.toFixed(2)}，请及时催收。`,
          targetId: payment.remainsId,
        },
      });
    }
  }

  console.log(`[定时任务] 欠费扫描完成，共发现 ${overduePayments.length} 条欠费记录`);
};

export const resetCoolingFurnaces = async () => {
  console.log('[定时任务] 检查冷却中的火化炉...');

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const coolingFurnaces = await prisma.cremationFurnace.findMany({
    where: { status: 'COOLING_DOWN' },
  });

  const cremations = await prisma.cremation.findMany({
    where: {
      furnaceId: { in: coolingFurnaces.map((f) => f.id) },
      status: 'COMPLETED',
      endTime: { lte: twoHoursAgo },
    },
  });

  const furnaceIdsToReset = new Set(cremations.map((c) => c.furnaceId));

  for (const id of furnaceIdsToReset) {
    await prisma.cremationFurnace.update({
      where: { id },
      data: { status: 'AVAILABLE' },
    });
    console.log(`[火化炉] ${id} 冷却完成，已重置为可用状态`);
  }
};

export const startCronJobs = () => {
  console.log('[定时任务] 定时任务调度器已启动');

  cron.schedule('0 */4 * * *', () => {
    checkOverdueRemains().catch(console.error);
  });

  cron.schedule('0 */8 * * *', () => {
    checkOverduePayments().catch(console.error);
  });

  cron.schedule('*/30 * * * *', () => {
    resetCoolingFurnaces().catch(console.error);
  });

  cron.schedule('0 1 * * *', () => {
    console.log('[定时任务] 每日清理过期通知...');
  });

  setTimeout(() => {
    checkOverdueRemains().catch(console.error);
    checkOverduePayments().catch(console.error);
  }, 5000);
};
