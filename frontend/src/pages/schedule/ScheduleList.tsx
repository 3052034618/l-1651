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
} from 'antd';
import {
  CalendarOutlined,
  SwapOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
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

const ScheduleList = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Schedule[]>([]);
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
      setData(res as Schedule[]);
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
      message.success(`已生成 ${res.count} 条排班记录`);
      setGenerateVisible(false);
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
        } catch (e) {}
      },
    });
  };

  const handleSubmitRequest = async () => {
    try {
      const values = await requestForm.validateFields();
      const data = {
        ...values,
        originalDate: values.originalDate?.format('YYYY-MM-DD'),
        requestedDate: values.requestedDate?.format('YYYY-MM-DD'),
      };
      await scheduleApi.createShiftRequest(data);
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

  const scheduleColumns = [
    {
      title: '员工',
      dataIndex: ['user', 'realName'],
      key: 'user',
      width: 100,
      fixed: 'left' as const,
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
      width: 120,
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

  const uniqueUsers = Array.from(
    new Map(data.map((item) => [item.userId, item])).values()
  ).map((item) => ({
    userId: item.userId,
    user: item.user,
  }));

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
          <Text type="secondary">选择要生成排班的周起始日期（周一），系统将根据员工技能和工时上限自动生成排班。</Text>
        </div>
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
