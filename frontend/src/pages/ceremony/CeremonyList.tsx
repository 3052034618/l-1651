import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  DatePicker,
  Space,
  Tag,
  Modal,
  Typography,
  message,
  Form,
  Input,
  Popconfirm,
} from 'antd';
import {
  CalendarOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LikeOutlined,
  DislikeOutlined,
} from '@ant-design/icons';
import { ceremonyApi } from '../../api/endpoints';
import { Ceremony, CEREMONY_STATUS_MAP } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

const statusColorMap: Record<string, string> = {
  PENDING: 'gold',
  APPROVED: 'blue',
  IN_PROGRESS: 'processing',
  COMPLETED: 'green',
  CANCELLED: 'default',
  REJECTED: 'red',
};

const CeremonyList = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Ceremony[]>([]);
  const [date, setDate] = useState<any>(dayjs());
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectId, setRejectId] = useState<string>('');
  const [rejectForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await ceremonyApi.list({
        date: date ? date.format('YYYY-MM-DD') : undefined,
      });
      setData(res as Ceremony[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [date]);

  const handleGenerate = async () => {
    Modal.confirm({
      title: '生成每日排程',
      content: `确定要为 ${date.format('YYYY-MM-DD')} 自动生成告别仪式排程吗？系统将根据遗体预约时间、厅室容量和司仪资质自动分配。`,
      onOk: async () => {
        try {
          const res: any = await ceremonyApi.generateSchedule(date.format('YYYY-MM-DD'));
          message.success(`已生成 ${res.count} 条排程`);
          loadData();
        } catch (e) {}
      },
    });
  };

  const handleApprove = async (id: string) => {
    try {
      await ceremonyApi.approve(id);
      message.success('审批通过，已推送至各岗位');
      loadData();
    } catch (e) {}
  };

  const handleReject = (id: string) => {
    setRejectId(id);
    setRejectVisible(true);
  };

  const handleRejectSubmit = async () => {
    try {
      const values = await rejectForm.validateFields();
      await ceremonyApi.reject(rejectId, values.reason);
      message.success('已拒绝排程');
      setRejectVisible(false);
      rejectForm.resetFields();
      loadData();
    } catch (e) {}
  };

  const handleStart = async (id: string) => {
    try {
      await ceremonyApi.start(id);
      message.success('告别仪式已开始');
      loadData();
    } catch (e) {}
  };

  const handleComplete = async (id: string) => {
    try {
      await ceremonyApi.complete(id);
      message.success('告别仪式已完成');
      loadData();
    } catch (e) {}
  };

  const columns = [
    {
      title: '时间',
      key: 'time',
      width: 180,
      render: (_: any, r: Ceremony) => (
        <div>
          <div>{dayjs(r.startTime).format('HH:mm')} - {dayjs(r.endTime).format('HH:mm')}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{dayjs(r.startTime).format('YYYY-MM-DD')}</div>
        </div>
      ),
    },
    {
      title: '逝者姓名',
      dataIndex: ['remains', 'name'],
      key: 'name',
      width: 100,
    },
    {
      title: '家属',
      dataIndex: ['remains', 'familyName'],
      key: 'familyName',
      width: 100,
    },
    {
      title: '告别厅',
      dataIndex: ['hall', 'name'],
      key: 'hall',
      width: 120,
      render: (v: string, r: Ceremony) => (
        <div>
          <div>{v}</div>
          <div style={{ color: '#999', fontSize: 12 }}>容纳{r.hall?.capacity}人</div>
        </div>
      ),
    },
    {
      title: '司仪',
      dataIndex: ['host', 'realName'],
      key: 'host',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={statusColorMap[v]}>
          {CEREMONY_STATUS_MAP[v as keyof typeof CEREMONY_STATUS_MAP]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_: any, record: Ceremony) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<LikeOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                审批通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<DislikeOutlined />}
                onClick={() => handleReject(record.id)}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status === 'APPROVED' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record.id)}
            >
              开始仪式
            </Button>
          )}
          {record.status === 'IN_PROGRESS' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleComplete(record.id)}
            >
              完成仪式
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>告别仪式管理</Title>
        <Space>
          <DatePicker value={date} onChange={setDate} style={{ width: 180 }} />
          <Button type="primary" icon={<CalendarOutlined />} onClick={handleGenerate}>
            自动生成排程
          </Button>
        </Space>
      </div>

      <div className="table-container">
        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
        />
      </div>

      <Modal
        title="拒绝排程"
        open={rejectVisible}
        onCancel={() => setRejectVisible(false)}
        onOk={handleRejectSubmit}
        okText="确认拒绝"
        cancelText="取消"
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            label="拒绝原因"
            name="reason"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <TextArea rows={4} placeholder="请输入拒绝排程的原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CeremonyList;
