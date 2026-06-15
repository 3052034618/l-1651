import express from 'express';
import cors from 'cors';
import { PORT } from './config';
import { errorHandler } from './middleware/errorHandler';
import { startCronJobs } from './jobs/cronJobs';

import authRoutes from './routes/auth';
import remainsRoutes from './routes/remains';
import ceremonyRoutes from './routes/ceremony';
import cremationRoutes from './routes/cremation';
import ashesRoutes from './routes/ashes';
import paymentRoutes from './routes/payment';
import scheduleRoutes from './routes/schedule';
import statisticsRoutes from './routes/statistics';
import notificationRoutes from './routes/notifications';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/remains', remainsRoutes);
app.use('/api/ceremony', ceremonyRoutes);
app.use('/api/cremation', cremationRoutes);
app.use('/api/ashes', ashesRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`殡仪馆管理系统后端服务已启动: http://localhost:${PORT}`);
  console.log(`API文档基础路径: http://localhost:${PORT}/api`);
  startCronJobs();
});

export default app;
