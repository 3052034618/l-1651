import { useEffect, useState } from 'react';
import { Row, Col, Card, List, Tag, Space, Button, Typography, Empty } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  FireOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { statisticsApi, remainsApi, notificationApi } from '../api/endpoints';
import { REMAINS_STATUS_MAP } from '../types';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title } = Typography;

const Dashboard = () => {
  const [overview, setOverview] = useState<any>(null);
  const [overdueList, setOverdueList] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ov, overdue, notif] = await Promise.all([
        statisticsApi.overview(),
        remainsApi.getOverdueList(),
        notificationApi.list(),
      ] as any);
      setOverview(ov);
      setOverdueList(overdue as any[]);
      setNotifications((notif as any[]).slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

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

  const statCards = [
    {
      title: '今日登记遗体',
      value: overview?.today?.remains || 0,
      icon: <TeamOutlined style={{ fontSize: 36, color: '#1677ff' }} />,
      color: '#1677ff',
    },
    {
      title: '今日告别仪式',
      value: overview?.today?.ceremonies || 0,
      icon: <FileTextOutlined style={{ fontSize: 36, color: '#722ed1' }} />,
      color: '#722ed1',
    },
    {
      title: '今日火化数量',
      value: overview?.today?.cremations || 0,
      icon: <FireOutlined style={{ fontSize: 36, color: '#f5222d' }} />,
      color: '#f5222d',
    },
    {
      title: '本月营收(元)',
      value: (overview?.monthRevenue || 0).toLocaleString(),
      icon: <DollarOutlined style={{ fontSize: 36, color: '#fa8c16' }} />,
      color: '#fa8c16',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>工作台</Title>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} md={6} key={index}>
            <Card loading={loading}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ marginRight: 16 }}>{card.icon}</div>
                <div>
                  <div style={{ fontSize: 14, color: '#666' }}>{card.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 600, color: card.color }}>
                    {card.value}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                <span>超期未处理遗体 ({overdueList.length})</span>
              </Space>
            }
            extra={
              <Link to="/remains">
                <Button type="link">查看全部</Button>
              </Link>
            }
            loading={loading}
          >
            {overdueList.length === 0 ? (
              <Empty description="暂无超期记录" />
            ) : (
              <List
                dataSource={overdueList}
                renderItem={(item: any) => (
                  <List.Item key={item.id}>
                    <List.Item.Meta
                      avatar={<Tag color="red">超期{item.overdueHours}小时</Tag>}
                      title={item.name}
                      description={
                        <Space>
                          <span>身份证：{item.idCardNumber}</span>
                          <span>柜位：{item.cabinet?.cabinetNo}</span>
                          <span>登记：{dayjs(item.createdAt).format('MM-DD HH:mm')}</span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title="遗体状态分布"
            loading={loading}
          >
            <Row gutter={[8, 8]}>
              {(overview?.remainsByStatus || []).map((item: any) => (
                <Col span={8} key={item.status}>
                  <div
                    style={{
                      padding: 12,
                      background: '#fafafa',
                      borderRadius: 6,
                      textAlign: 'center',
                    }}
                  >
                    <Tag color={statusColorMap[item.status] || 'default'}>
                      {REMAINS_STATUS_MAP[item.status as keyof typeof REMAINS_STATUS_MAP] || item.status}
                    </Tag>
                    <div style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>
                      {item.count}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Card
        title="系统通知"
        style={{ marginTop: 16 }}
        loading={loading}
      >
        {notifications.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item: any) => (
              <List.Item key={item.id}>
                <List.Item.Meta
                  avatar={
                    item.isRead ? (
                      <Tag>通知</Tag>
                    ) : (
                      <Tag color="blue">新</Tag>
                    )
                  }
                  title={item.title}
                  description={
                    <Space direction="vertical" size={0}>
                      <span>{item.content}</span>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
