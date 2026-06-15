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
  Select,
  Row,
  Col,
  Card,
  Descriptions,
  Tabs,
  Input,
  Alert,
} from 'antd';
import {
  DollarOutlined,
  CalculatorOutlined,
  CreditCardOutlined,
  WarningOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { paymentApi } from '../../api/endpoints';
import { Payment, PAYMENT_STATUS_MAP, PAYMENT_METHOD_MAP, FeeRecord } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const paymentStatusColorMap: Record<string, string> = {
  UNPAID: 'red',
  PARTIAL_PAID: 'gold',
  PAID: 'green',
  OVERDUE: 'magenta',
};

const feeCategoryMap: Record<string, string> = {
  TRANSPORT: '遗体接运',
  STORAGE: '冷藏保存',
  CEREMONY: '告别仪式',
  CREMATION: '火化服务',
  NICHE_STORAGE: '骨灰寄存',
  OTHER: '其他费用',
};

const remainsStatusMap: Record<string, string> = {
  REGISTERED: '已登记',
  IN_STORAGE: '冷藏中',
  CEREMONY_SCHEDULED: '已排告别',
  IN_CEREMONY: '告别中',
  CEREMONY_COMPLETED: '告别完成',
  AWAITING_CREMATION: '待火化',
  IN_CREMATION: '火化中',
  CREMATED: '已火化',
};

const PaymentList = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Payment[]>([]);
  const [remainsToBill, setRemainsToBill] = useState<any[]>([]);
  const [overdueList, setOverdueList] = useState<any[]>([]);
  const [payVisible, setPayVisible] = useState(false);
  const [payId, setPayId] = useState<string>('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<Payment | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewRemains, setPreviewRemains] = useState<any>(null);
  const [previewFees, setPreviewFees] = useState<any>(null);
  const [payForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('bills');

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, overdue, toBill] = await Promise.all([
        paymentApi.getPayments(),
        paymentApi.getOverduePayments(),
        paymentApi.getRemainsToBill(),
      ]);
      setData(list as Payment[]);
      setOverdueList(overdue as any[]);
      setRemainsToBill(toBill as any[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleViewDetail = async (remainsId: string) => {
    try {
      const res: any = await paymentApi.getPayment(remainsId);
      setDetail(res);
      setDetailVisible(true);
    } catch (e) {}
  };

  const handlePreviewBill = async (remains: any) => {
    try {
      setPreviewRemains(remains);
      const res: any = await paymentApi.calculate(remains.id);
      setPreviewFees(res);
      setPreviewVisible(true);
    } catch (e) {}
  };

  const handleGenerateBill = async (remainsId: string) => {
    Modal.confirm({
      title: '生成账单',
      content: '确定要为该遗体生成正式账单吗？生成后可在账单列表中查看和缴费。',
      onOk: async () => {
        try {
          await paymentApi.generateBill(remainsId);
          message.success('账单已生成');
          setPreviewVisible(false);
          loadData();
          setActiveTab('bills');
        } catch (e) {}
      },
    });
  };

  const handlePay = (remainsId: string) => {
    setPayId(remainsId);
    setPayVisible(true);
  };

  const handlePaySubmit = async () => {
    try {
      const values = await payForm.validateFields();
      await paymentApi.pay(payId, values);
      message.success('缴费成功');
      setPayVisible(false);
      payForm.resetFields();
      loadData();
    } catch (e) {}
  };

  const filteredRemains = remainsToBill.filter((r) =>
    !searchText ||
    r.name?.includes(searchText) ||
    r.familyName?.includes(searchText) ||
    r.idCardNumber?.includes(searchText)
  );

  const billColumns = [
    {
      title: '遗体ID',
      dataIndex: 'remainsId',
      key: 'remainsId',
      width: 180,
      ellipsis: true,
    },
    {
      title: '费用总额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toFixed(2)}</span>,
    },
    {
      title: '已缴金额',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      width: 120,
      render: (v: number) => <span style={{ color: '#52c41a' }}>¥{v.toFixed(2)}</span>,
    },
    {
      title: '欠费金额',
      key: 'unpaid',
      width: 120,
      render: (_: any, r: Payment) => {
        const unpaid = r.totalAmount - r.paidAmount;
        return unpaid > 0 ? (
          <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{unpaid.toFixed(2)}</span>
        ) : (
          <span style={{ color: '#52c41a' }}>¥0.00</span>
        );
      },
    },
    {
      title: '支付状态',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 100,
      render: (v: string) => (
        <Tag color={paymentStatusColorMap[v]}>
          {PAYMENT_STATUS_MAP[v as keyof typeof PAYMENT_STATUS_MAP]}
        </Tag>
      ),
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (v: string) => v ? PAYMENT_METHOD_MAP[v as keyof typeof PAYMENT_METHOD_MAP] : '-',
    },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_: any, record: Payment) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.remainsId)}
          >
            明细
          </Button>
          {record.paymentStatus !== 'PAID' && (
            <Button
              type="link"
              size="small"
              type="primary"
              icon={<CreditCardOutlined />}
              onClick={() => handlePay(record.remainsId)}
            >
              缴费
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const remainsColumns = [
    {
      title: '逝者姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '家属姓名',
      dataIndex: 'familyName',
      key: 'familyName',
      width: 100,
    },
    {
      title: '身份证号',
      dataIndex: 'idCardNumber',
      key: 'idCardNumber',
      width: 180,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag>{remainsStatusMap[v] || v}</Tag>,
    },
    {
      title: '登记时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handlePreviewBill(record)}
          >
            生成账单
          </Button>
        </Space>
      ),
    },
  ];

  const totalRevenue = data
    .filter((d) => d.paymentStatus === 'PAID')
    .reduce((sum, d) => sum + d.paidAmount, 0);

  const totalUnpaid = data.reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>收费管理</Title>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div className="stat-card">
              <div className="stat-label">账单总数</div>
              <div className="stat-value">{data.length}</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div className="stat-card">
              <div className="stat-label">已收金额</div>
              <div className="stat-value" style={{ color: '#52c41a' }}>¥{totalRevenue.toLocaleString()}</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div className="stat-card">
              <div className="stat-label">欠费总额</div>
              <div className="stat-value" style={{ color: '#f5222d' }}>¥{totalUnpaid.toLocaleString()}</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div className="stat-card">
              <div className="stat-label">待开单遗体</div>
              <div className="stat-value" style={{ color: '#1677ff' }}>{remainsToBill.length}</div>
            </div>
          </Card>
        </Col>
      </Row>

      {overdueList.length > 0 && (
        <Alert
          message={`欠费催缴提醒：有${overdueList.length}条逾期账单`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="待开单遗体" key="toBill">
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <Input
                placeholder="搜索姓名/身份证号"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Button type="primary" onClick={loadData}>
                刷新
              </Button>
            </Space>
          </Card>
          <div className="table-container">
            <Table
              loading={loading}
              columns={remainsColumns}
              dataSource={filteredRemains}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              emptyDescription="暂无待开单的遗体"
            />
          </div>
        </TabPane>

        <TabPane tab="账单列表" key="bills">
          <div className="table-container">
            <Table
              loading={loading}
              columns={billColumns}
              dataSource={data}
              rowKey="id"
            />
          </div>
        </TabPane>
      </Tabs>

      <Modal
        title="费用明细"
        open={detailVisible}
        width={700}
        onCancel={() => setDetailVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>]}
      >
        {detail && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="费用总额">¥{detail.totalAmount.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="已缴金额">¥{detail.paidAmount.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="欠费金额" span={2}>
                <span style={{ color: detail.totalAmount - detail.paidAmount > 0 ? '#f5222d' : '#52c41a', fontWeight: 600 }}>
                  ¥{(detail.totalAmount - detail.paidAmount).toFixed(2)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="支付状态">
                <Tag color={paymentStatusColorMap[detail.paymentStatus]}>
                  {PAYMENT_STATUS_MAP[detail.paymentStatus as keyof typeof PAYMENT_STATUS_MAP]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">
                {detail.paymentMethod ? PAYMENT_METHOD_MAP[detail.paymentMethod as keyof typeof PAYMENT_METHOD_MAP] : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>费用明细：</Typography.Text>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={detail.records || []}
              columns={[
                {
                  title: '类别',
                  dataIndex: ['feeItem', 'category'],
                  key: 'category',
                  render: (v: string) => feeCategoryMap[v] || v,
                },
                { title: '项目名称', dataIndex: ['feeItem', 'name'], key: 'name' },
                { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', render: (v: number) => `¥${v.toFixed(2)}` },
                { title: '数量', dataIndex: 'quantity', key: 'quantity' },
                { title: '单位', dataIndex: ['feeItem', 'unit'], key: 'unit' },
                {
                  title: '小计',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  render: (v: number) => <b>¥{v.toFixed(2)}</b>,
                },
              ]}
            />
          </>
        )}
      </Modal>

      <Modal
        title="预览费用 - 生成账单"
        open={previewVisible}
        width={700}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setPreviewVisible(false)}>取消</Button>,
          <Button key="confirm" type="primary" icon={<PlusOutlined />} onClick={() => previewRemains && handleGenerateBill(previewRemains.id)}>
            确认生成账单
          </Button>,
        ]}
      >
        {previewRemains && previewFees && (
          <>
            <Alert
              message="逝者信息"
              description={
                <Space>
                  <span>姓名：{previewRemains.name}</span>
                  <span>家属：{previewRemains.familyName}</span>
                  <span>身份证：{previewRemains.idCardNumber}</span>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="遗体接运">¥{(previewFees.categories?.TRANSPORT || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="冷藏保存">¥{(previewFees.categories?.STORAGE || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="告别仪式">¥{(previewFees.categories?.CEREMONY || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="火化服务">¥{(previewFees.categories?.CREMATION || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="骨灰寄存">¥{(previewFees.categories?.NICHE_STORAGE || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="其他费用">¥{(previewFees.categories?.OTHER || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="费用总计" span={2}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#f5222d' }}>
                  ¥{previewFees.totalAmount?.toFixed(2) || '0.00'}
                </span>
              </Descriptions.Item>
            </Descriptions>

            {previewFees.records && previewFees.records.length > 0 && (
              <>
                <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>费用明细：</Typography.Text>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="id"
                  dataSource={previewFees.records}
                  columns={[
                    {
                      title: '类别',
                      dataIndex: 'category',
                      key: 'category',
                      width: 100,
                      render: (v: string) => feeCategoryMap[v] || v,
                    },
                    { title: '项目名称', dataIndex: 'name', key: 'name' },
                    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 80, render: (v: number) => `¥${v.toFixed(2)}` },
                    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 60 },
                    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
                    {
                      title: '小计',
                      dataIndex: 'subtotal',
                      key: 'subtotal',
                      width: 100,
                      render: (v: number) => <b>¥{v.toFixed(2)}</b>,
                    },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Modal>

      <Modal
        title="费用缴纳"
        open={payVisible}
        onCancel={() => setPayVisible(false)}
        onOk={handlePaySubmit}
        okText="确认支付"
        cancelText="取消"
      >
        <Form form={payForm} layout="vertical">
          <Form.Item
            label="支付金额 (元)"
            name="amount"
            rules={[{ required: true, message: '请输入支付金额' }]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} placeholder="请输入支付金额" />
          </Form.Item>
          <Form.Item
            label="支付方式"
            name="paymentMethod"
            rules={[{ required: true, message: '请选择支付方式' }]}
          >
            <Select placeholder="请选择支付方式">
              <Option value="CASH">现金</Option>
              <Option value="CARD">银行卡</Option>
              <Option value="ALIPAY">支付宝</Option>
              <Option value="WECHAT">微信支付</Option>
              <Option value="TRANSFER">银行转账</Option>
            </Select>
          </Form.Item>
          <Form.Item label="交易流水号（可选）" name="transactionId">
            <Input placeholder="请输入交易流水号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PaymentList;
