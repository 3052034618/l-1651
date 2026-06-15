import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  DatePicker,
  Space,
  Tag,
  Typography,
  message,
  Modal,
  Form,
  Select,
  Input,
  Tabs,
  List,
  Avatar,
  Row,
  Col,
  Card,
  Progress,
  Descriptions,
  Divider,
  Alert,
  Tooltip,
} from 'antd';
import {
  CalendarOutlined,
  SwapOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { scheduleApi } from '../../api/endpoints';
import { Schedule, SHIFT_TYPE_MAP, ShiftType } from '../../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const shiftColorMap: Record<string, string> = {
  MORNING: 'green',
  AFTERNOON: 'blue',
  NIGHT: 'purple',
  DAY_OFF: 'default',
};

const requestStatusMap: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待审批', color: 'gold' },
  APPROVED: { text: '已批准', color: 'green' },
  REJECTED: { text: '已拒绝', color: 'red' },
};

const roleMap: Record<string, string> = {
  HOST: '司仪',
  CREMATOR: '火化员',
  RECEPTION: '接待员',
  STAFF: '通用员工',
  ADMIN: '管理员',
  SUPERVISOR: '主管',
};

const skillLabelMap: Record<string, string> = {
  HOST: '司仪',
  CREMATOR: '火化员',
  RECEPTION: '接待员',
};

const ScheduleList = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Schedule[]>([]);
  const [userStats, setUserStats] = useState<Record<string, any>>({});
  const [dailyCoverage, setDailyCoverage] = useState<Record<string, any>>({});
  const [skillsMap, setSkillsMap] = useState<Record<string, string>>({});
  const [coverageGaps, setCoverageGaps] = useState<any[]>([]);
  const [poolStats, setPoolStats] = useState<Record<string, number>>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<any>([dayjs().startOf('week'), dayjs().endOf('week')]);
  const [generateVisible, setGenerateVisible] = useState(false);
  const [generateDate, setGenerateDate] = useState<any>(dayjs().startOf('week'));
  const [requestVisible, setRequestVisible] = useState(false);
  const [requestForm] = Form.useForm();

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const res: any = await scheduleApi.list({
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      });
      if (res.schedules) {
        setData(res.schedules as Schedule[]);
        setUserStats(res.userStats || {});
        setDailyCoverage(res.dailyCoverage || {});
        setSkillsMap(res.skillsMap || {});
        setCoverageGaps(res.coverageGaps || []);
        setPoolStats(res.poolStats || {});
      } else {
        setData(res as Schedule[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const res: any = await scheduleApi.getShiftRequests();
      setRequests(res as any[]);
    } catch (e) {}
  };

  useEffect(() => {
    loadSchedule();
    loadRequests();
  }, [dateRange]);

  const handleGenerate = async () => {
    try {
      const res: any = await scheduleApi.generateWeekly(generateDate.format('YYYY-MM-DD'));
      setGenerateVisible(false);
      if (res.coverageGaps && res.coverageGaps.length > 0) {
        setCoverageGaps(res.coverageGaps || []);
        setDailyCoverage(res.dailyCoverage || {});
        setPoolStats(res.poolStats || {});
        message.warning(`已生成 ${res.count} 条排班，但 ${res.coverageGaps.length} 个班次存在岗位缺口，请查看下方详情`);
      } else {
        setCoverageGaps([]);
        message.success(`已生成 ${res.count} 条排班记录，所有岗位已覆盖`);
      }
      loadSchedule();
    } catch (e) {}
  };

  const handleApproveRequest = async (id: string) => {
    try {
      await scheduleApi.approveShiftRequest(id);
      message.success('调班申请已批准');
      loadRequests();
      loadSchedule();
    } catch (e) {}
  };

  const handleRejectRequest = async (id: string) => {
    Modal.confirm({
      title: '拒绝调班申请',
      content: '确定要拒绝该调班申请吗？',
      onOk: async () => {
        try {
          await scheduleApi.rejectShiftRequest(id, '不符合排班要求');
          message.success('已拒绝申请');
          loadRequests();
          loadSchedule();
        } catch (e) {}
      },
    });
  };

  const handleSubmitRequest = async () => {
    try {
      const values = await requestForm.validateFields();
      const reqData = {
        ...values,
        originalDate: values.originalDate?.format('YYYY-MM-DD'),
        requestedDate: values.requestedDate?.format('YYYY-MM-DD'),
      };
      await scheduleApi.createShiftRequest(reqData);
      message.success('调班申请已提交');
      setRequestVisible(false);
      requestForm.resetFields();
      loadRequests();
    } catch (e) {}
  };

  const groupedByDate = data.reduce((acc: Record<string, Schedule[]>, item) => {
    const date = dayjs(item.date).format('YYYY-MM-DD');
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});

  const dates = Object.keys(groupedByDate).sort();

  const uniqueUsers = Array.from(
    new Map(data.map((item) => [item.userId, item])).values()
  ).map((item) => ({
    userId: item.userId,
    user: item.user,
  }));

  const scheduleColumns = [
    {
      title: '员工',
      key: 'user',
      width: 240,
      fixed: 'left' as const,
      render: (_: any, record: any) => {
        const stats = userStats[record.userId] || {};
        const userRole = (record.user as any)?.role || stats.role;
        const userSkills = stats.skills || (record.user as any)?.skills || '';
        const skillNames = userSkills
          ? userSkills.split(',').map((s: string) => skillsMap[s] || s).join('、')
          : (roleMap[userRole] || '');
        const percent = stats.maxHours ? Math.min(100, (stats.hours / stats.maxHours) * 100) : 0;
        const isOver = stats.hours > 0 && stats.hours >= (stats.maxHours || 0);
        return (
          <div style={{ padding: 4 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {(record.user as any)?.realName || stats.name}
              <Tag style={{ marginLeft: 8 }} color="blue">{skillNames}</Tag>
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
              已排: {stats.hours || 0}h / 上限: {stats.maxHours || 56}h ({stats.shifts || 0}班)
            </div>
            <Progress
              percent={Number(percent.toFixed(0))}
              size="small"
              showInfo={false}
              strokeColor={isOver ? '#ff4d4f' : percent > 80 ? '#faad14' : '#52c41a'}
            />
          </div>
        );
      },
    },
    ...dates.map((date) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>{dayjs(date).format('MM-DD')}</div>
          <div style={{ color: '#999', fontSize: 12, fontWeight: 'normal' }}>
            {dayjs(date).format('ddd')}
          </div>
        </div>
      ),
      dataIndex: date,
      key: date,
      width: 130,
      align: 'center' as const,
      render: (_: any, record: Schedule) => {
        const daySchedule = groupedByDate[date]?.find((s) => s.userId === record.userId);
        if (!daySchedule) return <Text type="secondary">-</Text>;
        return (
          <Tag color={shiftColorMap[daySchedule.shiftType]}>
            {SHIFT_TYPE_MAP[daySchedule.shiftType as ShiftType]}
          </Tag>
        );
      },
    })),
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>排班管理</Title>
        <Space>
          <Button icon={<SwapOutlined />} onClick={() => setRequestVisible(true)}>
            申请调班
          </Button>
          <Button type="primary" icon={<CalendarOutlined />} onClick={() => setGenerateVisible(true)}>
            自动生成周排班
          </Button>
        </Space>
      </div>

      <Tabs defaultActiveKey="schedule">
        <TabPane tab="排班表" key="schedule">
          <Space style={{ marginBottom: 16 }}>
            <RangePicker value={dateRange} onChange={setDateRange} />
            <Button type="primary" onClick={loadSchedule}>查询</Button>
          </Space>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="排班规则说明"
            description={
              <Space size={16} wrap>
                <Tag color="blue"><TeamOutlined /> 每班次至少2人</Tag>
                <Tag color="green"><UserOutlined /> 早/午/夜必须覆盖司仪、火化员、接待员</Tag>
                <Tag color="purple"><ThunderboltOutlined /> 每人周工时不超过上限</Tag>
                <Tag color="orange"><WarningOutlined /> 有岗位缺口会在下方标红列出原因</Tag>
                {Object.keys(poolStats).length > 0 && (
                  <>
                    <Divider type="vertical" />
                    <Tag color="cyan">人员池：司仪 {poolStats.HOST || 0}人</Tag>
                    <Tag color="cyan">火化员 {poolStats.CREMATOR || 0}人</Tag>
                    <Tag color="cyan">接待员 {poolStats.RECEPTION || 0}人</Tag>
                  </>
                )}
              </Space>
            }
          />

          {coverageGaps.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message={`共有 ${coverageGaps.length} 个班次存在岗位缺口，请人工补位或调班`}
              description={
                <Row gutter={[8, 8]}>
                  {coverageGaps.map((gap, i) => (
                    <Col xs={24} sm={12} md={8} key={i}>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="日期/班次">
                          <Tag color="red">{dayjs(gap.date).format('MM-DD')} {SHIFT_TYPE_MAP[gap.shift as ShiftType]}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="缺岗">
                          <Space>
                            {(gap.missingSkills || []).map((s: string) => (
                              <Tag key={s} color="red" icon={<ExclamationCircleOutlined />}>
                                {skillLabelMap[s] || s}
                              </Tag>
                            ))}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="缺岗原因">
                          <span style={{ color: '#ff4d4f', fontSize: 12 }}>{gap.reason}</span>
                        </Descriptions.Item>
                      </Descriptions>
                    </Col>
                  ))}
                </Row>
              }
            />
          )}

          {Object.keys(dailyCoverage).length > 0 && (
            <Card title="每日岗位覆盖情况" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[8, 8]}>
                {dates.map((date) => {
                  const coverage = dailyCoverage[date] || {};
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={date}>
                      <Card size="small" type="inner" title={dayjs(date).format('MM-DD ddd')}>
                        <Descriptions column={1} size="small" bordered>
                          {['MORNING', 'AFTERNOON', 'NIGHT'].map((shift) => {
                            const shiftData = coverage[shift] || {};
                            const shiftLabel = SHIFT_TYPE_MAP[shift as ShiftType];
                            const missing = shiftData.missingSkills || [];
                            const hasGap = missing.length > 0;
                            return (
                              <Descriptions.Item key={shift} label={
                                <Space>
                                  <span>{shiftLabel}</span>
                                  {hasGap && <Tag color="red" style={{ margin: 0 }}>缺{missing.length}岗</Tag>}
                                </Space>
                              }>
                                <Space size={4} wrap>
                                  <Tooltip title={shiftData.hasHost ? '司仪已覆盖' : missing.includes('HOST') ? '司仪缺口' : ''}>
                                    <Tag color={shiftData.hasHost ? 'green' : 'red'}>
                                      {shiftData.hasHost ? '✓ 司仪' : '✗ 司仪'}
                                    </Tag>
                                  </Tooltip>
                                  <Tooltip title={shiftData.hasCremator ? '火化员已覆盖' : missing.includes('CREMATOR') ? '火化员缺口' : ''}>
                                    <Tag color={shiftData.hasCremator ? 'green' : 'red'}>
                                      {shiftData.hasCremator ? '✓ 火化员' : '✗ 火化员'}
                                    </Tag>
                                  </Tooltip>
                                  <Tooltip title={shiftData.hasReception ? '接待员已覆盖' : missing.includes('RECEPTION') ? '接待员缺口' : ''}>
                                    <Tag color={shiftData.hasReception ? 'green' : 'red'}>
                                      {shiftData.hasReception ? '✓ 接待' : '✗ 接待'}
                                    </Tag>
                                  </Tooltip>
                                </Space>
                              </Descriptions.Item>
                            );
                          })}
                        </Descriptions>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          )}

          {Object.keys(userStats).length > 0 && (
            <Card title="员工工时统计" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[8, 8]}>
                {Object.entries(userStats).map(([userId, stats]: [string, any]) => {
                  const percent = stats.maxHours ? Math.min(100, (stats.hours / stats.maxHours) * 100) : 0;
                  const isOver = stats.hours > 0 && stats.hours >= (stats.maxHours || 0);
                  const skillDisplay = stats.skills
                    ? stats.skills.split(',').map((s: string) => skillsMap[s] || s).join('、')
                    : (roleMap[stats.role] || '');
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={userId}>
                      <Card size="small" type="inner">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600 }}>
                            <UserOutlined style={{ marginRight: 4 }} />
                            {stats.name}
                          </span>
                          <Tag color="blue">{skillDisplay}</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                          已排 <b>{stats.hours || 0}h</b> / 上限 {stats.maxHours || 56}h ({stats.shifts || 0}班)
                        </div>
                        <Progress
                          percent={Number(percent.toFixed(0))}
                          size="small"
                          strokeColor={isOver ? '#ff4d4f' : percent > 80 ? '#faad14' : '#52c41a'}
                        />
                        {isOver && (
                          <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                            <ThunderboltOutlined /> 已达工时上限
                          </div>
                        )}
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          )}

          <Divider style={{ margin: '8px 0 16px 0' }} />

          <div className="table-container">
            <Table
              loading={loading}
              columns={scheduleColumns}
              dataSource={uniqueUsers}
              rowKey="userId"
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </TabPane>

        <TabPane tab={`调班申请 (${requests.filter((r) => r.status === 'PENDING').length})`} key="requests">
          <div className="table-container">
            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无调班申请</div>
            ) : (
              <List
                dataSource={requests}
                renderItem={(item: any) => (
                  <List.Item
                    key={item.id}
                    actions={
                      item.status === 'PENDING'
                        ? [
                            <Button
                              key="approve"
                              type="link"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={() => handleApproveRequest(item.id)}
                            >
                              批准
                            </Button>,
                            <Button
                              key="reject"
                              type="link"
                              size="small"
                              danger
                              icon={<CloseOutlined />}
                              onClick={() => handleRejectRequest(item.id)}
                            >
                              拒绝
                            </Button>,
                          ]
                        : null
                    }
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={
                        <Space>
                          <span>{item.user?.realName}</span>
                          <Tag color={requestStatusMap[item.status]?.color}>
                            {requestStatusMap[item.status]?.text}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div>
                            原班次：{dayjs(item.originalDate).format('YYYY-MM-DD')}{' '}
                            {SHIFT_TYPE_MAP[item.originalShift as ShiftType]}
                            {' → '}
                            申请调至：{dayjs(item.requestedDate).format('YYYY-MM-DD')}{' '}
                            {SHIFT_TYPE_MAP[item.requestedShift as ShiftType]}
                          </div>
                          <div style={{ color: '#666', marginTop: 4 }}>原因：{item.reason}</div>
                          <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                            提交时间：{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </TabPane>
      </Tabs>

      <Modal
        title="自动生成周排班"
        open={generateVisible}
        onCancel={() => setGenerateVisible(false)}
        onOk={handleGenerate}
        okText="生成排班"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            选择要生成排班的周起始日期（周一），系统将根据：
          </Text>
        </div>
        <ul style={{ margin: '0 0 16px 0', paddingLeft: 20, color: '#666' }}>
          <li><TeamOutlined /> 员工岗位技能（司仪/火化员/接待员）</li>
          <li><ThunderboltOutlined /> 每人每日和每周工时上限</li>
          <li><CalendarOutlined /> 确保每日每个班次三个核心岗位都有人覆盖</li>
        </ul>
        <DatePicker value={generateDate} onChange={setGenerateDate} style={{ width: '100%' }} picker="week" />
      </Modal>

      <Modal
        title="申请调班"
        open={requestVisible}
        onCancel={() => setRequestVisible(false)}
        onOk={handleSubmitRequest}
        okText="提交申请"
        cancelText="取消"
      >
        <Form form={requestForm} layout="vertical">
          <Form.Item
            label="原班次日期"
            name="originalDate"
            rules={[{ required: true, message: '请选择原班次日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="原班次类型"
            name="originalShift"
            rules={[{ required: true, message: '请选择原班次类型' }]}
          >
            <Select placeholder="请选择原班次">
              <Option value="MORNING">早班</Option>
              <Option value="AFTERNOON">午班</Option>
              <Option value="NIGHT">夜班</Option>
              <Option value="DAY_OFF">休息</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="调班日期"
            name="requestedDate"
            rules={[{ required: true, message: '请选择调班日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="调班后班次"
            name="requestedShift"
            rules={[{ required: true, message: '请选择调班后班次' }]}
          >
            <Select placeholder="请选择调班后班次">
              <Option value="MORNING">早班</Option>
              <Option value="AFTERNOON">午班</Option>
              <Option value="NIGHT">夜班</Option>
              <Option value="DAY_OFF">休息</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="调班原因"
            name="reason"
            rules={[{ required: true, message: '请输入调班原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入调班原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ScheduleList;
