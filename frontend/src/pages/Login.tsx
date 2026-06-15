import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { login: setAuth } = useAuth();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res: any = await login(values);
      setAuth(res.user, res.token);
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-box" bordered={false}>
        <div className="login-title">
          <h1>殡仪馆综合管理系统</h1>
          <p>Funeral Management System</p>
        </div>
        <Form name="login" onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登 录
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
            默认账号：admin / 123456
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
