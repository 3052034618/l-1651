import api from './client';

export const login = (data: { username: string; password: string }) =>
  api.post('/auth/login', data);

export const getCurrentUser = () => api.get('/auth/me');

export const remainsApi = {
  list: (params: any) => api.get('/remains', { params }),
  get: (id: string) => api.get(`/remains/${id}`),
  create: (data: any) => api.post('/remains', data),
  validateIdCard: (idCardNumber: string) =>
    api.post('/remains/validate-idcard', { idCardNumber }),
  updateStatus: (id: string, status: string) =>
    api.put(`/remains/${id}/status`, { status }),
  getCabinetStats: () => api.get('/remains/cabinets/stats'),
  getCabinets: () => api.get('/remains/cabinets/list'),
  getOverdueList: () => api.get('/remains/overdue/list'),
};

export const ceremonyApi = {
  list: (params: any) => api.get('/ceremony', { params }),
  generateSchedule: (date: string) =>
    api.post('/ceremony/generate-schedule', { date }),
  approve: (id: string) => api.post(`/ceremony/${id}/approve`),
  reject: (id: string, reason: string) =>
    api.post(`/ceremony/${id}/reject`, { reason }),
  start: (id: string) => api.post(`/ceremony/${id}/start`),
  complete: (id: string) => api.post(`/ceremony/${id}/complete`),
  getHalls: () => api.get('/ceremony/halls/list'),
};

export const cremationApi = {
  list: (params: any) => api.get('/cremation', { params }),
  generateSequence: () => api.post('/cremation/generate-sequence'),
  start: (id: string) => api.post(`/cremation/${id}/start`),
  complete: (id: string, data: { fuelUsed: number; emissionLevel: number }) =>
    api.post(`/cremation/${id}/complete`, data),
  getFurnaces: () => api.get('/cremation/furnaces/list'),
  refuelFurnace: (id: string, amount: number) =>
    api.post(`/cremation/furnaces/${id}/refuel`, { amount }),
};

export const ashesApi = {
  list: (params: any) => api.get('/ashes', { params }),
  allocate: (data: any) => api.post('/ashes/allocate', data),
  pickup: (id: string, data: { pickedUpBy: string; pickupCode: string }) =>
    api.post(`/ashes/${id}/pickup`, data),
  getNicheStats: () => api.get('/ashes/niches/stats'),
  getNiches: () => api.get('/ashes/niches/list'),
};

export const paymentApi = {
  calculate: (remainsId: string) =>
    api.get(`/payment/calculate/${remainsId}`),
  generate: (remainsId: string) =>
    api.post(`/payment/generate/${remainsId}`),
  getPayments: (params?: any) => api.get('/payment/payments', { params }),
  getPayment: (remainsId: string) => api.get(`/payment/payments/${remainsId}`),
  pay: (remainsId: string, data: { amount: number; paymentMethod: string }) =>
    api.post(`/payment/pay/${remainsId}`, data),
  getOverduePayments: () => api.get('/payment/overdue/payments'),
  getFeeItems: () => api.get('/payment/fee-items'),
};

export const scheduleApi = {
  list: (params: any) => api.get('/schedule', { params }),
  generateWeekly: (startDate: string) =>
    api.post('/schedule/generate-weekly', { startDate }),
  mySchedule: () => api.get('/schedule/my-schedule'),
  createShiftRequest: (data: any) =>
    api.post('/schedule/shift-request', data),
  getShiftRequests: (params?: any) =>
    api.get('/schedule/shift-requests', { params }),
  approveShiftRequest: (id: string) =>
    api.post(`/schedule/shift-requests/${id}/approve`),
  rejectShiftRequest: (id: string, reason: string) =>
    api.post(`/schedule/shift-requests/${id}/reject`, { reason }),
};

export const statisticsApi = {
  overview: () => api.get('/statistics/overview'),
  serviceStatistics: (params: any) =>
    api.get('/statistics/service-statistics', { params }),
  revenueStatistics: (params: any) =>
    api.get('/statistics/revenue-statistics', { params }),
  equipmentUtilization: (params: any) =>
    api.get('/statistics/equipment-utilization', { params }),
  monthlyReport: (params: any) =>
    api.get('/statistics/monthly-report', { params }),
};

export const notificationApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  unreadCount: () => api.get('/notifications/unread/count'),
};
