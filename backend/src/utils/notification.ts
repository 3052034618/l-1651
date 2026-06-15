import prisma from '../lib/prisma';
import { NotificationType, UserRole } from '../types/enums';

export const createNotification = async (data: {
  userId?: string;
  type: string;
  title: string;
  content: string;
  targetId?: string;
}) => {
  return prisma.notification.create({
    data,
  });
};

export const notifyRole = async (
  role: string,
  data: {
    type: string;
    title: string;
    content: string;
    targetId?: string;
  }
) => {
  const users = await prisma.user.findMany({
    where: { role },
    select: { id: true },
  });

  const notifications = await Promise.all(
    users.map((user) =>
      prisma.notification.create({
        data: {
          ...data,
          userId: user.id,
        },
      })
    )
  );

  return notifications;
};

export const notifyUsers = async (
  userIds: string[],
  data: {
    type: string;
    title: string;
    content: string;
    targetId?: string;
  }
) => {
  const notifications = await Promise.all(
    userIds.map((userId) =>
      prisma.notification.create({
        data: {
          ...data,
          userId,
        },
      })
    )
  );

  return notifications;
};

export const NotificationTemplates = {
  ceremonyApproved: (remainsName: string, hallName: string, hostName: string, time: string) => ({
    type: NotificationType.CEREMONY_APPROVAL,
    title: '告别仪式排程已审批',
    content: `【${remainsName}】的告别仪式排程已通过审批。厅室：${hallName}，司仪：${hostName}，时间：${time}`,
  }),
  shiftRequest: (userName: string, reason: string) => ({
    type: NotificationType.SHIFT_REQUEST,
    title: '新的调班申请',
    content: `员工【${userName}】提交了调班申请，原因：${reason}`,
  }),
  shiftApproved: (originalDate: string, requestedDate: string) => ({
    type: NotificationType.SHIFT_REQUEST,
    title: '调班申请已批准',
    content: `您的调班申请已批准。原班次：${originalDate}，新班次：${requestedDate}`,
  }),
  paymentReminder: (remainsName: string, amount: number) => ({
    type: NotificationType.PAYMENT_REMINDER,
    title: '费用催缴通知',
    content: `【${remainsName}】的费用账单待支付，金额：¥${amount.toFixed(2)}`,
  }),
  overdueReminder: (remainsName: string, hours: number) => ({
    type: NotificationType.OVERDUE_REMINDER,
    title: '遗体超期存放提醒',
    content: `【${remainsName}】已存放超过${hours}小时未处理，请及时跟进。`,
  }),
};
