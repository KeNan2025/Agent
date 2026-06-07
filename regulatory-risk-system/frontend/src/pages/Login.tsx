import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, Form, Input, message, Tabs, Typography } from 'antd';
import { LockOutlined, UserOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { authLogin, authRegister } from '../api/client';
import { loginToken } from '../store/auth';

const { Title, Text } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from ?? '/';
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  const onLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await authLogin(values.username, values.password);
      loginToken(res.access_token);
      message.success(`欢迎回来 #${res.user_id}`);
      navigate(from, { replace: true });
    } catch (e: any) {
      message.error('登录失败：' + (e?.response?.data?.detail ?? e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await authRegister(values.username, values.password);
      loginToken(res.access_token);
      message.success(`注册成功 #${res.user_id}`);
      navigate(from, { replace: true });
    } catch (e: any) {
      message.error('注册失败：' + (e?.response?.data?.detail ?? e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--body-bg)',
      padding: 24,
    }}>
      <Card
        style={{ width: '100%', maxWidth: 420 }}
        styles={{ body: { padding: 36 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: 'var(--primary-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 24px rgba(24, 144, 255, 0.35)',
          }}>
            <ThunderboltOutlined style={{ color: '#fff', fontSize: 28 }} />
          </div>
          <Title level={3} style={{ marginBottom: 4, color: 'var(--text-bright)' }}>
            扫雷预警系统
          </Title>
          <Text style={{ color: 'var(--text-dim)' }}>
            上市公司监管问询概率预测
          </Text>
        </div>

        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as any)}
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form layout="vertical" onFinish={onLogin} disabled={loading}>
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                    <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block size="large">
                    登录
                  </Button>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form layout="vertical" onFinish={onRegister} disabled={loading}>
                  <Form.Item
                    name="username"
                    rules={[
                      { required: true, message: '请输入用户名' },
                      { min: 3, message: '用户名至少 3 个字符' },
                    ]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="用户名（≥3 字符）" size="large" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '密码至少 6 个字符' },
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="密码（≥6 字符）" size="large" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block size="large">
                    注册并登录
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
