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
  Alert,
  Descriptions,
  Tooltip,
  Card,
  Row,
  Col,
} from 'antd';
import {
  CalendarOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LikeOutlined,
  DislikeOutlined,
  CheckOutlined,
  WarningOutlined,
  TeamOutlined,
  UserOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
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

const PREFERENCE_LABEL_MAP: Record<string, string> = {
  SIMPLE: '简约',
  TRADITIONAL: '传统',
  BUDDHIST: '佛教',
  CHRISTIAN: '基督教',
  CUSTOM: '个性化',
};

const CeremonyList = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Ceremony[]>([]);
  const [date, setDate] = useState<any>(dayjs());
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectId, setRejectId] = useState<string>('');
  const [rejectForm] = Form.useForm();
  const [unmatchedList, setUnmatchedList] = useState<any[]>([]);

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
          if (res.unmatchedCount && res.unmatchedCount > 0) {
            setUnmatchedList(res.unmatchedDetails || []);
            message.warning(`已生成 ${res.count} 条排程，${res.unmatchedCount} 条未排成功，请查看下方详情`);
          } else {
            setUnmatchedList([]);
            message.success(`已生成 ${res.count} 条排程`);
          }
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
      width: 170,
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
      title: '家属偏好',
      dataIndex: ['remains', 'ceremonyPreference'],
      key: 'preference',
      width: 110,
      render: (v: string) => v ? (
        <Tag color="purple">
          <InfoCircleOutlined /> {PREFERENCE_LABEL_MAP[v] || v}
        </Tag>
      ) : <span style={{ color: '#999' }}>无</span>,
    },
    {
      title: '告别厅',
      dataIndex: ['hall', 'name'],
      key: 'hall',
      width: 120,
      render: (v: string, r: Ceremony) => v ? (
        <div>
          <div><EnvironmentOutlined /> {v}</div>
          <div style={{ color: '#999', fontSize: 12 }}>容纳{r.hall?.capacity}人</div>
        </div>
      ) : <Tag color="red"><WarningOutlined /> 未分配</Tag>,
    },
    {
      title: '司仪与资质',
      key: 'hostDetail',
      width: 200,
      render: (_: any, r: any) => {
        if (!r.host?.realName) {
          return <Tag color="red"><WarningOutlined /> 未分配司仪</Tag>;
        }
        const skills: string[] = r.hostSkills || (r.host?.skills ? r.host.skills.split(',') : []) || [];
        const matched: boolean = r.preferenceMatched;
        const pref = r.remains?.ceremonyPreference;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserOutlined /> <span style={{ fontWeight: 600 }}>{r.host.realName}</span>
              {pref && (matched
                ? <Tag color="green" icon={<CheckOutlined />}>偏好匹配</Tag>
                : <Tag color="orange" icon={<WarningOutlined />}>资质不符</Tag>)}
            </div>
            <div style={{ marginTop: 4 }}>
              {skills.length > 0 ? skills.map((s, i) => (
                <Tag key={i} color="blue" style={{ marginBottom: 2 }}>{s}</Tag>
              )) : <Tag>通用</Tag>}
            </div>
          </div>
        );
      },
    },
    {
      title: '预计人数',
      dataIndex: ['remains', 'expectedAttendees'],
      key: 'expectedAttendees',
      width: 90,
      render: (v: number) => v ? <Tag><TeamOutlined /> {v}人</Tag> : '-',
    },
    {
      title: '分配原因',
      dataIndex: 'allocationReason',
      key: 'allocationReason',
      width: 300,
      render: (v: string) => v ? (
        <Tooltip title={v}>
          <span style={{ fontSize: 12, color: v.includes('未排成功') ? '#ff4d4f' : '#555', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {v}
          </span>
        </Tooltip>
      ) : '-',
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
      width: 220,
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

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="排程规则"
        description={
          <Space size={16} wrap>
            <Tag color="blue"><TeamOutlined /> 按预计人数匹配最小容量厅</Tag>
            <Tag color="green"><UserOutlined /> 优先匹配家属偏好对应司仪资质</Tag>
            <Tag color="orange"><WarningOutlined /> 资质不符时回退至时间可用司仪</Tag>
            <Tag color="purple"><InfoCircleOutlined /> 未排成功会显示详细原因</Tag>
          </Space>
        }
      />

      {unmatchedList.length > 0 && (
        <Card
          type="inner"
          style={{ marginBottom: 16 }}
          title={<span><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />本次未排成功的遗体（共{unmatchedList.length}位，请人工调整）</span>}
        >
          <Row gutter={[8, 8]}>
            {unmatchedList.map((u, i) => (
              <Col xs={24} sm={12} md={8} key={i}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="逝者姓名">{u.remainsName}</Descriptions.Item>
                  <Descriptions.Item label="家属偏好">
                    {u.preference ? <Tag color="purple">{u.preference}</Tag> : <span style={{ color: '#999' }}>无</span>}
                  </Descriptions.Item>
                  <Descriptions.Item label="预约时间">{u.time}</Descriptions.Item>
                  <Descriptions.Item label="未排原因">
                    <span style={{ color: '#ff4d4f', fontSize: 12 }}>{u.reason}</span>
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <div className="table-container">
        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
          scroll={{ x: 1400 }}
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
