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
  InputNumber,
  Card,
  Progress,
  Row,
  Col,
  Alert,
  Descriptions,
  Tooltip,
} from 'antd';
import {
  FireOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { cremationApi } from '../../api/endpoints';
import { Cremation, CREMATION_STATUS_MAP, CremationFurnace } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusColorMap: Record<string, string> = {
  QUEUED: 'gold',
  IN_PROGRESS: 'processing',
  COMPLETED: 'green',
  CANCELLED: 'default',
};

const furnaceTypeMap: Record<string, string> = {
  TYPE_A: 'A型环保炉',
  TYPE_B: 'B型标准炉',
  TYPE_C: 'C型普通炉',
};

const furnaceStatusMap: Record<string, { color: string; text: string }> = {
  AVAILABLE: { color: 'green', text: '可用' },
  IN_USE: { color: 'processing', text: '使用中' },
  MAINTENANCE: { color: 'red', text: '维护中' },
  COOLING_DOWN: { color: 'orange', text: '冷却中' },
};

const MIN_FUEL = 20;
const MIN_ECO = 60;

const CremationList = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Cremation[]>([]);
  const [furnaces, setFurnaces] = useState<CremationFurnace[]>([]);
  const [excludedFurnaces, setExcludedFurnaces] = useState<any[]>([]);
  const [completeVisible, setCompleteVisible] = useState(false);
  const [completeId, setCompleteId] = useState<string>('');
  const [completeForm] = Form.useForm();
  const [refuelVisible, setRefuelVisible] = useState(false);
  const [refuelId, setRefuelId] = useState<string>('');
  const [refuelForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, furnaceList] = await Promise.all([
        cremationApi.list({}),
        cremationApi.getFurnaces(),
      ]);
      setData(list as Cremation[]);
      setFurnaces(furnaceList as CremationFurnace[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async () => {
    Modal.confirm({
      title: '生成火化顺序',
      content: (
        <div>
          <p>确定要根据以下约束自动生成火化顺序吗？</p>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#666' }}>
            <li><ThunderboltOutlined /> 燃料≥{MIN_FUEL}%（不足的炉排除）</li>
            <li><InfoCircleOutlined /> 环保评级≥{MIN_ECO}分（不达标炉排除）</li>
            <li><FireOutlined /> 优先选择环保等级≥80分的炉</li>
            <li><DashboardOutlined /> 负载均衡分配</li>
          </ul>
        </div>
      ),
      onOk: async () => {
        try {
          const res: any = await cremationApi.generateSequence();
          if (res.excludedFurnaces && res.excludedFurnaces.length > 0) {
            setExcludedFurnaces(res.excludedFurnaces);
            const reasons = {};
            res.excludedFurnaces.forEach((f: any) => {
              const r = f.reason || '其他原因';
              reasons[r] = (reasons[r] || 0) + 1;
            });
            const reasonText = Object.entries(reasons).map(([k, v]) => `${k}×${v}`).join('，');
            message.warning(`已生成 ${res.count} 条火化任务，${res.excludedFurnaces.length} 台炉未进入候选：${reasonText}，详情见下方`);
          } else {
            setExcludedFurnaces([]);
            message.success(`已生成 ${res.count} 条火化任务`);
          }
          loadData();
        } catch (e: any) {
          message.error(e.response?.data?.message || '生成失败');
        }
      },
    });
  };

  const handleStart = async (id: string) => {
    try {
      await cremationApi.start(id);
      message.success('火化已开始');
      loadData();
    } catch (e) {}
  };

  const handleComplete = (id: string) => {
    setCompleteId(id);
    setCompleteVisible(true);
  };

  const handleCompleteSubmit = async () => {
    try {
      const values = await completeForm.validateFields();
      await cremationApi.complete(completeId, values);
      message.success('火化已完成登记');
      setCompleteVisible(false);
      completeForm.resetFields();
      loadData();
    } catch (e) {}
  };

  const handleRefuel = (id: string) => {
    setRefuelId(id);
    setRefuelVisible(true);
  };

  const handleRefuelSubmit = async () => {
    try {
      const values = await refuelForm.validateFields();
      await cremationApi.refuelFurnace(refuelId, values.amount);
      message.success('燃料补充成功');
      setRefuelVisible(false);
      refuelForm.resetFields();
      loadData();
    } catch (e) {}
  };

  const columns = [
    {
      title: '序号',
      dataIndex: 'sequence',
      key: 'sequence',
      width: 60,
      render: (v: number) => <Tag color="blue">#{v}</Tag>,
    },
    {
      title: '逝者姓名',
      dataIndex: ['remains', 'name'],
      key: 'name',
      width: 100,
    },
    {
      title: '火化炉',
      dataIndex: ['furnace', 'furnaceNo'],
      key: 'furnace',
      width: 120,
      render: (v: string, r: Cremation) => (
        <div>
          <div>{v}</div>
          <div style={{ color: '#999', fontSize: 12 }}>
            {furnaceTypeMap[r.furnace?.type || 'TYPE_A']}
          </div>
        </div>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '完成时间',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '燃料消耗',
      dataIndex: 'fuelUsed',
      key: 'fuelUsed',
      width: 100,
      render: (v: number) => v != null ? `${v}L` : '-',
    },
    {
      title: '排放值',
      dataIndex: 'emissionLevel',
      key: 'emissionLevel',
      width: 100,
      render: (v: number) => {
        if (v == null) return '-';
        const color = v < 50 ? 'green' : v < 80 ? 'orange' : 'red';
        return <Tag color={color}>{v}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={statusColorMap[v]}>
          {CREMATION_STATUS_MAP[v as keyof typeof CREMATION_STATUS_MAP]}
        </Tag>
      ),
    },
    {
      title: '排序原因',
      dataIndex: 'sortReason',
      key: 'sortReason',
      width: 300,
      render: (v: string) => v ? (
        <Tooltip title={v}>
          <span style={{ fontSize: 12, color: '#555' }}>{v}</span>
        </Tooltip>
      ) : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: any, record: Cremation) => (
        <Space size="small">
          {record.status === 'QUEUED' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record.id)}
            >
              开始火化
            </Button>
          )}
          {record.status === 'IN_PROGRESS' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleComplete(record.id)}
            >
              完成登记
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>火化管理</Title>
        <Button type="primary" icon={<FireOutlined />} onClick={handleGenerate}>
          自动生成火化顺序
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="火化排序算法约束"
        description={
          <Space size={16} wrap>
            <Tag color="blue"><ThunderboltOutlined /> 燃料≥{MIN_FUEL}%</Tag>
            <Tag color="green"><InfoCircleOutlined /> 环保评级≥{MIN_ECO}分</Tag>
            <Tag color="purple"><FireOutlined /> 优先选择环保≥80分</Tag>
            <Tag color="orange"><DashboardOutlined /> 负载均衡分配</Tag>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {furnaces.map((f: any) => (
          <Col xs={24} sm={12} md={6} key={f.id}>
            <Card size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{f.furnaceNo}</div>
                  <div style={{ color: '#999', fontSize: 12 }}>{f.typeName}</div>
                </div>
                <Tag color={furnaceStatusMap[f.status]?.color}>
                  {furnaceStatusMap[f.status]?.text}
                </Tag>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                  <span>环保评级</span>
                  <span>
                    <Tag color={f.ecoRating >= 80 ? 'green' : f.ecoRating >= 60 ? 'orange' : 'red'} size="small">
                      {f.ecoRating}分
                    </Tag>
                    {f.ecoRating < 60 && <StopOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                  <span><DashboardOutlined /> 燃料</span>
                  <span style={{ color: f.fuelWarning ? '#ff4d4f' : undefined }}>{f.fuelLevel}%</span>
                </div>
                <Progress
                  percent={f.fuelLevel}
                  size="small"
                  showInfo={false}
                  strokeColor={f.fuelWarning ? '#ff4d4f' : undefined}
                />
                {f.fuelWarning && <span style={{ color: '#ff4d4f', fontSize: 12 }}><ThunderboltOutlined /> 燃料不足</span>}
              </div>
              {f.fuelWarning && f.status === 'AVAILABLE' && (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  block
                  style={{ marginTop: 8 }}
                  onClick={() => handleRefuel(f.id)}
                >
                  补充燃料
                </Button>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {excludedFurnaces.length > 0 && (
        <Card
          title={<span><StopOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />本次排序排除的火化炉（共{excludedFurnaces.length}台）</span>}
          size="small"
          style={{ marginBottom: 16 }}
          type="inner"
        >
          <Row gutter={[8, 8]}>
            {excludedFurnaces.map((f: any) => (
              <Col xs={24} sm={12} md={8} key={f.id}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="炉号">{f.furnaceNo}</Descriptions.Item>
                  <Descriptions.Item label="排除原因">
                    <Tag color="red">{f.reason}</Tag>
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
        />
      </div>

      <Modal
        title="火化完成登记"
        open={completeVisible}
        onCancel={() => setCompleteVisible(false)}
        onOk={handleCompleteSubmit}
        okText="确认登记"
        cancelText="取消"
      >
        <Form form={completeForm} layout="vertical">
          <Form.Item
            label="燃料使用量 (L)"
            name="fuelUsed"
            rules={[{ required: true, message: '请输入燃料使用量' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入燃料使用量" />
          </Form.Item>
          <Form.Item
            label="排放检测值 (0-100，低于80为合格)"
            name="emissionLevel"
            rules={[{ required: true, message: '请输入排放检测值' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="请输入排放检测值" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="补充燃料"
        open={refuelVisible}
        onCancel={() => setRefuelVisible(false)}
        onOk={handleRefuelSubmit}
        okText="确认补充"
        cancelText="取消"
      >
        <Form form={refuelForm} layout="vertical">
          <Form.Item
            label="补充燃料量 (%)"
            name="amount"
            rules={[{ required: true, message: '请输入补充量' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="请输入补充量" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CremationList;
