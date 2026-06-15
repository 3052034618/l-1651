import { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  DatePicker,
  Space,
  Button,
  Table,
  Tag,
  Progress,
  Statistic,
  Empty,
  Divider,
} from 'antd';
import {
  BarChartOutlined,
  DownloadOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { statisticsApi } from '../../api/endpoints';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker, MonthPicker } = DatePicker;

const feeCategoryMap: Record<string, string> = {
  TRANSPORT: '遗体接运',
  STORAGE: '冷藏保存',
  CEREMONY: '告别仪式',
  CREMATION: '火化服务',
  NICHE_STORAGE: '骨灰寄存',
  OTHER: '其他费用',
};

const Statistics = () => {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [serviceStats, setServiceStats] = useState<any>(null);
  const [revenueStats, setRevenueStats] = useState<any>(null);
  const [equipmentStats, setEquipmentStats] = useState<any>(null);
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const [dateRange, setDateRange] = useState<any>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [reportMonth, setReportMonth] = useState<any>(dayjs());
  const [activeTab, setActiveTab] = useState<'overview' | 'monthly'>('overview');

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [ov, service, revenue, equipment] = await Promise.all([
        statisticsApi.overview(),
        statisticsApi.serviceStatistics({
          startDate: dateRange[0]?.format('YYYY-MM-DD'),
          endDate: dateRange[1]?.format('YYYY-MM-DD'),
        }),
        statisticsApi.revenueStatistics({
          startDate: dateRange[0]?.format('YYYY-MM-DD'),
          endDate: dateRange[1]?.format('YYYY-MM-DD'),
        }),
        statisticsApi.equipmentUtilization({
          startDate: dateRange[0]?.format('YYYY-MM-DD'),
          endDate: dateRange[1]?.format('YYYY-MM-DD'),
        }),
      ]);
      setOverview(ov);
      setServiceStats(service);
      setRevenueStats(revenue);
      setEquipmentStats(equipment);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReport = async () => {
    setLoading(true);
    try {
      const res: any = await statisticsApi.monthlyReport({
        year: reportMonth.year(),
        month: reportMonth.month() + 1,
      });
      setMonthlyReport(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverview();
    } else {
      loadMonthlyReport();
    }
  }, [activeTab, dateRange, reportMonth]);

  const exportReport = () => {
    if (!monthlyReport) return;
    const data = JSON.stringify(monthlyReport, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `月度运营报表_${monthlyReport.period.year}年${monthlyReport.period.month}月.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>统计报表</Title>
        <Space>
          <Button.Group>
            <Button
              type={activeTab === 'overview' ? 'primary' : 'default'}
              onClick={() => setActiveTab('overview')}
            >
              综合统计
            </Button>
            <Button
              type={activeTab === 'monthly' ? 'primary' : 'default'}
              onClick={() => setActiveTab('monthly')}
            >
              月度报表
            </Button>
          </Button.Group>
        </Space>
      </div>

      {activeTab === 'overview' ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Text>统计区间：</Text>
              <RangePicker value={dateRange} onChange={setDateRange} />
              <Button type="primary" onClick={loadOverview}>
                <BarChartOutlined /> 查询
              </Button>
            </Space>
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Card loading={loading}>
                <Statistic title="登记遗体数" value={serviceStats?.total?.remains || 0} suffix="具" />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card loading={loading}>
                <Statistic title="告别仪式数" value={serviceStats?.total?.ceremonies || 0} suffix="场" />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card loading={loading}>
                <Statistic title="火化数" value={serviceStats?.total?.cremations || 0} suffix="具" />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card loading={loading}>
                <Statistic
                  title="营收总额"
                  value={revenueStats?.total || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={12}>
              <Card title="收入类别分析" loading={loading}>
                {revenueStats?.byCategory ? (
                  <div>
                    {Object.entries(revenueStats.byCategory).map(([key, value]: [string, any]) => {
                      const percent = revenueStats.total > 0 ? (value / revenueStats.total) * 100 : 0;
                      return (
                        <div key={key} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>{feeCategoryMap[key] || key}</span>
                            <span style={{ fontWeight: 600 }}>¥{value.toFixed(2)} ({percent.toFixed(1)}%)</span>
                          </div>
                          <Progress percent={percent} showInfo={false} />
                        </div>
                      );
                    })}
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>支付笔数</span>
                      <span>{revenueStats?.paymentCount || 0} 笔</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>平均客单价</span>
                      <span style={{ fontWeight: 600 }}>¥{(revenueStats?.averagePayment || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <Empty />
                )}
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card title="设备利用率" loading={loading}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>火化炉</Text>
                {(equipmentStats?.furnaces || []).map((f: any) => (
                  <div key={f.furnaceNo} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{f.furnaceNo} ({f.type === 'TYPE_A' ? 'A' : f.type === 'TYPE_B' ? 'B' : 'C'}型)</span>
                      <span>使用率 {f.utilizationRate}% · 使用{f.usageCount}次</span>
                    </div>
                    <Progress percent={parseFloat(f.utilizationRate)} showInfo={false} />
                  </div>
                ))}

                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>告别厅</Text>
                {(equipmentStats?.halls || []).map((h: any) => (
                  <div key={h.hallNo} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{h.name} ({h.capacity}人)</span>
                      <span>使用率 {h.utilizationRate}% · 使用{h.usageCount}次</span>
                    </div>
                    <Progress percent={parseFloat(h.utilizationRate)} showInfo={false} />
                  </div>
                ))}
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Text>报表月份：</Text>
              <MonthPicker value={reportMonth} onChange={setReportMonth} />
              <Button type="primary" onClick={loadMonthlyReport}>
                <CalendarOutlined /> 生成报表
              </Button>
              {monthlyReport && (
                <Button icon={<DownloadOutlined />} onClick={exportReport}>
                  导出JSON
                </Button>
              )}
            </Space>
          </Card>

          {monthlyReport && (
            <div>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={4}>
                  <Card size="small">
                    <Statistic title="遗体登记" value={monthlyReport.summary.remainsCount} suffix="具" />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Card size="small">
                    <Statistic title="告别仪式" value={monthlyReport.summary.ceremoniesCount} suffix="场" />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Card size="small">
                    <Statistic title="火化数量" value={monthlyReport.summary.cremationsCount} suffix="具" />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Card size="small">
                    <Statistic title="骨灰寄存" value={monthlyReport.summary.ashesStoredCount} suffix="位" />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Card size="small">
                    <Statistic title="营收总额" value={monthlyReport.summary.totalRevenue} precision={2} prefix="¥" valueStyle={{ color: '#3f8600' }} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Card size="small">
                    <Statistic title="支付笔数" value={monthlyReport.summary.paymentCount} suffix="笔" />
                  </Card>
                </Col>
              </Row>

              <Card title="各类别收入明细" style={{ marginBottom: 16 }}>
                <Row gutter={[16, 16]}>
                  {Object.entries(monthlyReport.revenueByCategory).map(([key, value]: [string, any]) => (
                    <Col xs={24} sm={12} md={8} key={key}>
                      <div style={{ padding: 16, background: '#fafafa', borderRadius: 6 }}>
                        <div style={{ color: '#666', marginBottom: 8 }}>{feeCategoryMap[key] || key}</div>
                        <div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff' }}>
                          ¥{value.toFixed(2)}
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>

              <Card title="遗体登记明细">
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={monthlyReport.remains}
                  pagination={false}
                  columns={[
                    { title: '姓名', dataIndex: 'name', key: 'name' },
                    { title: '状态', dataIndex: 'status', key: 'status' },
                    {
                      title: '登记时间',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
                    },
                  ]}
                />
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Statistics;
