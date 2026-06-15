import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  message,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Card,
  Empty,
} from 'antd';
import {
  HeartOutlined,
  PlusOutlined,
  CreditCardOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { ashesApi } from '../../api/endpoints';
import { Ashes, PICKUP_STATUS_MAP } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const pickupStatusColorMap: Record<string, string> = {
  NOT_PICKED: 'blue',
  PENDING_PICKUP: 'gold',
  PICKED_UP: 'green',
};

const nicheLevelMap: Record<string, { text: string; color: string }> = {
  NORMAL: { text: '普通区', color: 'default' },
  DELUXE: { text: '豪华区', color: 'blue' },
  PREMIUM: { text: '尊享区', color: 'gold' },
};

const nicheStatusColorMap: Record<string, string> = {
  AVAILABLE: 'green',
  OCCUPIED: 'red',
  RESERVED: 'blue',
  MAINTENANCE: 'orange',
};

const AshesList = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Ashes[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [allocateVisible, setAllocateVisible] = useState(false);
  const [pickupVisible, setPickupVisible] = useState(false);
  const [pickupId, setPickupId] = useState<string>('');
  const [allocateForm] = Form.useForm();
  const [pickupForm] = Form.useForm();
  const [pickupCode, setPickupCode] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, nicheStats] = await Promise.all([
        ashesApi.list({}),
        ashesApi.getNicheStats(),
      ]);
      setData(list as Ashes[]);
      setStats(nicheStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAllocate = async () => {
    try {
      const values = await allocateForm.validateFields();
      const res: any = await ashesApi.allocate(values);
      message.success(res.message);
      setPickupCode(res.pickupCode);
      setAllocateVisible(false);
      allocateForm.resetFields();
      loadData();
      Modal.success({
        title: '格位分配成功',
        content: (
          <div>
            <p>领取凭证码：<Tag color="blue" style={{ fontSize: 18, padding: '4px 12px' }}>{res.pickupCode}</Tag></p>
            <p style={{ color: '#999' }}>请妥善保管此凭证码，领取骨灰时需出示</p>
          </div>
        ),
      });
    } catch (e) {}
  };

  const handlePickup = (id: string) => {
    setPickupId(id);
    setPickupVisible(true);
  };

  const handlePickupSubmit = async () => {
    try {
      const values = await pickupForm.validateFields();
      await ashesApi.pickup(pickupId, values);
      message.success('骨灰领取登记成功');
      setPickupVisible(false);
      pickupForm.resetFields();
      loadData();
    } catch (e) {}
  };

  const columns = [
    {
      title: '逝者姓名',
      dataIndex: ['remains', 'name'],
      key: 'name',
      width: 100,
    },
    {
      title: '格位编号',
      dataIndex: ['niche', 'nicheNo'],
      key: 'nicheNo',
      width: 140,
    },
    {
      title: '区域等级',
      dataIndex: ['niche', 'level'],
      key: 'level',
      width: 100,
      render: (v: string) => (
        <Tag color={nicheLevelMap[v]?.color}>{nicheLevelMap[v]?.text}</Tag>
      ),
    },
    {
      title: '寄存开始时间',
      dataIndex: 'storageStart',
      key: 'storageStart',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '领取凭证码',
      dataIndex: 'pickupCode',
      key: 'pickupCode',
      width: 120,
      render: (v: string) => <Tag color="purple"><CreditCardOutlined /> {v}</Tag>,
    },
    {
      title: '家属姓名',
      dataIndex: ['remains', 'familyName'],
      key: 'familyName',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: ['remains', 'familyPhone'],
      key: 'familyPhone',
      width: 130,
    },
    {
      title: '领取状态',
      dataIndex: 'pickupStatus',
      key: 'pickupStatus',
      width: 100,
      render: (v: string) => (
        <Tag color={pickupStatusColorMap[v]}>
          {PICKUP_STATUS_MAP[v as keyof typeof PICKUP_STATUS_MAP]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: Ashes) => (
        <Space size="small">
          {record.pickupStatus === 'NOT_PICKED' && (
            <Button
              type="link"
              size="small"
              icon={<GiftOutlined />}
              onClick={() => handlePickup(record.id)}
            >
              领取登记
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>骨灰管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAllocateVisible(true)}>
          分配骨灰格位
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div className="stat-card">
              <div className="stat-label">总格位数</div>
              <div className="stat-value">{stats?.total || 0}</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div className="stat-card">
              <div className="stat-label">可用格位</div>
              <div className="stat-value" style={{ color: '#52c41a' }}>{stats?.available || 0}</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div className="stat-card">
              <div className="stat-label">已占用</div>
              <div className="stat-value" style={{ color: '#f5222d' }}>{stats?.occupied || 0}</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div className="stat-card">
              <div className="stat-label">待领取</div>
              <div className="stat-value" style={{ color: '#faad14' }}>
                {data.filter((d) => d.pickupStatus === 'NOT_PICKED').length}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <div className="table-container">
        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
        />
      </div>

      <Modal
        title="分配骨灰格位"
        open={allocateVisible}
        onCancel={() => setAllocateVisible(false)}
        onOk={handleAllocate}
        okText="确认分配"
        cancelText="取消"
        width={500}
      >
        <Form form={allocateForm} layout="vertical">
          <Form.Item
            label="遗体ID（已火化）"
            name="remainsId"
            rules={[{ required: true, message: '请输入遗体ID' }]}
          >
            <Input placeholder="请输入已火化遗体的ID" />
          </Form.Item>
          <Form.Item label="格位等级（可选）" name="level">
            <Select placeholder="自动分配最优等级" allowClear>
              <Option value="NORMAL">普通区</Option>
              <Option value="DELUXE">豪华区</Option>
              <Option value="PREMIUM">尊享区</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="骨灰领取登记"
        open={pickupVisible}
        onCancel={() => setPickupVisible(false)}
        onOk={handlePickupSubmit}
        okText="确认领取"
        cancelText="取消"
      >
        <Form form={pickupForm} layout="vertical">
          <Form.Item
            label="领取人姓名"
            name="pickedUpBy"
            rules={[{ required: true, message: '请输入领取人姓名' }]}
          >
            <Input placeholder="请输入领取人姓名" />
          </Form.Item>
          <Form.Item
            label="领取凭证码"
            name="pickupCode"
            rules={[{ required: true, message: '请输入领取凭证码' }]}
          >
            <Input placeholder="请输入8位领取凭证码" maxLength={8} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AshesList;
