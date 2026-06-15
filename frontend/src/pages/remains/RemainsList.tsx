import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  Descriptions,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { remainsApi } from '../../api/endpoints';
import { Remains, REMAINS_STATUS_MAP } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const statusColorMap: Record<string, string> = {
  REGISTERED: 'default',
  IN_STORAGE: 'blue',
  CEREMONY_SCHEDULED: 'cyan',
  IN_CEREMONY: 'geekblue',
  CEREMONY_COMPLETED: 'purple',
  AWAITING_CREMATION: 'magenta',
  IN_CREMATION: 'red',
  CREMATED: 'volcano',
  ASHES_STORED: 'orange',
  ASHES_PICKED_UP: 'green',
  CANCELLED: 'default',
};

const RemainsList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Remains[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [detail, setDetail] = useState<Remains | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await remainsApi.list({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
      });
      setData(res.list);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleView = async (id: string) => {
    try {
      const res: any = await remainsApi.get(id);
      setDetail(res);
      setDetailVisible(true);
    } catch (e) {}
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 60,
      render: (v: string) => (v === 'MALE' ? '男' : v === 'FEMALE' ? '女' : '未知'),
    },
    {
      title: '身份证号',
      dataIndex: 'idCardNumber',
      key: 'idCardNumber',
      width: 180,
    },
    {
      title: '死亡日期',
      dataIndex: 'deathDate',
      key: 'deathDate',
      width: 120,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '家属姓名',
      dataIndex: 'familyName',
      key: 'familyName',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'familyPhone',
      key: 'familyPhone',
      width: 130,
    },
    {
      title: '冷藏柜位',
      dataIndex: ['cabinet', 'cabinetNo'],
      key: 'cabinetNo',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={statusColorMap[v]}>
          {REMAINS_STATUS_MAP[v as keyof typeof REMAINS_STATUS_MAP]}
        </Tag>
      ),
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
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: Remains) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>遗体管理</Title>
        <Link to="/remains/create">
          <Button type="primary" icon={<PlusOutlined />}>
            录入遗体信息
          </Button>
        </Link>
      </div>

      <div className="table-container">
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索姓名/身份证/家属"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 240 }}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="选择状态"
            value={status}
            onChange={(v) => setStatus(v)}
            style={{ width: 160 }}
            allowClear
          >
            {Object.entries(REMAINS_STATUS_MAP).map(([key, value]) => (
              <Option key={key} value={key}>{value}</Option>
            ))}
          </Select>
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={() => { setKeyword(''); setStatus(undefined); setPage(1); loadData(); }}>
            重置
          </Button>
        </Space>

        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </div>

      <Modal
        title="遗体详情"
        open={detailVisible}
        width={800}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
        ]}
      >
        {detail && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="姓名">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="性别">
              {detail.gender === 'MALE' ? '男' : detail.gender === 'FEMALE' ? '女' : '未知'}
            </Descriptions.Item>
            <Descriptions.Item label="身份证号">{detail.idCardNumber}</Descriptions.Item>
            <Descriptions.Item label="出生日期">
              {dayjs(detail.birthDate).format('YYYY-MM-DD')}
            </Descriptions.Item>
            <Descriptions.Item label="死亡日期">
              {dayjs(detail.deathDate).format('YYYY-MM-DD')}
            </Descriptions.Item>
            <Descriptions.Item label="死亡原因">{detail.deathCause}</Descriptions.Item>
            <Descriptions.Item label="死亡证明编号">{detail.deathCertNumber}</Descriptions.Item>
            <Descriptions.Item label="签发机构">{detail.deathCertIssuer}</Descriptions.Item>
            <Descriptions.Item label="家属姓名">{detail.familyName}</Descriptions.Item>
            <Descriptions.Item label="家属电话">{detail.familyPhone}</Descriptions.Item>
            <Descriptions.Item label="与逝者关系">{detail.familyRelation}</Descriptions.Item>
            <Descriptions.Item label="保存需求">
              {detail.storageRequirement === 'NORMAL' ? '普通冷藏' :
               detail.storageRequirement === 'LOW_TEMP' ? '低温冷藏' : '特殊冷藏'}
            </Descriptions.Item>
            <Descriptions.Item label="冷藏柜位">
              {detail.cabinet?.cabinetNo || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="预计告别时间">
              {detail.expectedCeremonyTime ? dayjs(detail.expectedCeremonyTime).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={statusColorMap[detail.status]}>
                {REMAINS_STATUS_MAP[detail.status as keyof typeof REMAINS_STATUS_MAP]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="登记时间">
              {dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default RemainsList;
