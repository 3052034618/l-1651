import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  FireOutlined,
  HeartOutlined,
  DollarOutlined,
  CalendarOutlined,
  BarChartOutlined,
  BellOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { notificationApi } from '../api/endpoints';
import { useEffect } from 'react';
import { useAuth } from '../App';

const { Header, Sider, Content } = Layout;

interface Props {
  user: User;
  children: React.ReactNode;
}

const MainLayout = ({ user, children }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { logout } = useAuth();

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res: any = await notificationApi.unreadCount();
        setUnreadCount(res.count);
      } catch (e) {}
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 30000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">工作台</Link> },
    { key: '/remains', icon: <TeamOutlined />, label: <Link to="/remains">遗体管理</Link> },
    { key: '/ceremony', icon: <FileTextOutlined />, label: <Link to="/ceremony">告别仪式</Link> },
    { key: '/cremation', icon: <FireOutlined />, label: <Link to="/cremation">火化管理</Link> },
    { key: '/ashes', icon: <HeartOutlined />, label: <Link to="/ashes">骨灰管理</Link> },
    { key: '/payment', icon: <DollarOutlined />, label: <Link to="/payment">收费管理</Link> },
    { key: '/schedule', icon: <CalendarOutlined />, label: <Link to="/schedule">排班管理</Link> },
    { key: '/statistics', icon: <BarChartOutlined />, label: <Link to="/statistics">统计报表</Link> },
  ];

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: () => {
          logout();
          navigate('/login');
        },
      },
    ],
  };

  const selectedKey = '/' + location.pathname.split('/')[1];

  return (
    <Layout className="app-container" style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 14 : 18,
            fontWeight: 600,
            background: 'rgba(255,255,255,0.1)',
          }}
        >
          {collapsed ? '殡仪' : '殡仪管理系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ marginRight: 24 }}>
            <Badge count={unreadCount} size="small">
              <BellOutlined style={{ fontSize: 20, color: '#666', cursor: 'pointer' }} />
            </Badge>
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <span>{user.realName}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 0, background: '#f0f2f5' }}>
          <div className="page-container">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
