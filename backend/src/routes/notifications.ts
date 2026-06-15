import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { userId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

router.post('/read-all', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    await prisma.notification.updateMany({
      where: {
        isRead: false,
        OR: [
          { userId },
          { userId: null },
        ],
      },
      data: { isRead: true },
    });
    res.json({ message: '已全部标记为已读' });
  } catch (error) {
    next(error);
  }
});

router.get('/unread/count', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const count = await prisma.notification.count({
      where: {
        isRead: false,
        OR: [
          { userId },
          { userId: null },
        ],
      },
    });
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

export default router;
