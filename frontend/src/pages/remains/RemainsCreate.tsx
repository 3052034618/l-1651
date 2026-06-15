import { useState } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  Typography,
  Row,
  Col,
  Space,
  message,
  Alert,
  Steps,
  InputNumber,
} from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { remainsApi } from '../../api/endpoints';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { Step } = Steps;

const RemainsCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [idCardValidated, setIdCardValidated] = useState(false);
  const [idCardInfo, setIdCardInfo] = useState<{ birthDate?: Dayjs; gender?: string } | null>(null);
  const [step, setStep] = useState(0);

  const validateIdCard = async (rule: any, value: string) => {
    if (!value) return Promise.resolve();
    try {
      const res: any = await remainsApi.validateIdCard(value);
      if (res.valid) {
        setIdCardValidated(true);
        setIdCardInfo({
          birthDate: res.birthDate ? dayjs(res.birthDate) : undefined,
          gender: res.gender,
        });
        if (res.birthDate) {
          form.setFieldsValue({
            birthDate: dayjs(res.birthDate),
            gender: res.gender,
          });
        }
        return Promise.resolve();
      } else {
        setIdCardValidated(false);
        setIdCardInfo(null);
        return Promise.reject(new Error(res.message));
      }
    } catch (e: any) {
      return Promise.reject(new Error(e.message || '身份证校验失败'));
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    setValidationErrors([]);
    try {
      const data = {
        ...values,
        birthDate: values.birthDate?.toISOString(),
        deathDate: values.deathDate?.toISOString(),
        expectedCeremonyTime: values.expectedCeremonyTime?.toISOString(),
      };
      const res: any = await remainsApi.create(data);
      if (res.errors && res.errors.length > 0) {
        setValidationErrors(res.errors);
        return;
      }
      message.success(`录入成功！${res.allocationMessage || ''}`);
      navigate('/remains');
    } catch (e: any) {
      if (e.response?.data?.errors) {
        setValidationErrors(e.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/remains')}>
            返回列表
          </Button>
          <Title level={3} style={{ margin: 0 }}>遗体信息录入</Title>
        </Space>
      </div>

      {validationErrors.length > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
          message="信息校验未通过"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          }
        />
      )}

      <Steps current={step} style={{ marginBottom: 24 }}>
        <Step title="身份信息" description="逝者身份证核验" />
        <Step title="家属信息" description="家属联系方式" />
        <Step title="保存安排" description="冷藏与告别安排" />
      </Steps>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={(changed) => {
          if (changed.idCardNumber) {
            setIdCardValidated(false);
            setIdCardInfo(null);
          }
        }}
      >
        <Card title="逝者信息" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="姓名"
                name="name"
                rules={[{ required: true, message: '请输入逝者姓名' }]}
              >
                <Input placeholder="请输入逝者姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="性别"
                name="gender"
                rules={[{ required: true, message: '请选择性别' }]}
              >
                <Select placeholder="请选择性别">
                  <Option value="MALE">男</Option>
                  <Option value="FEMALE">女</Option>
                  <Option value="UNKNOWN">未知</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="身份证号"
                name="idCardNumber"
                rules={[
                  { required: true, message: '请输入身份证号' },
                  { validator: validateIdCard },
                ]}
                extra={
                  idCardValidated ? (
                    <Text type="success">
                      <CheckCircleOutlined /> 身份证校验通过
                    </Text>
                  ) : null
                }
              >
                <Input placeholder="请输入18位身份证号，系统将自动核验" maxLength={18} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="出生日期"
                name="birthDate"
                rules={[{ required: true, message: '请选择出生日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择出生日期" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="死亡日期"
                name="deathDate"
                rules={[{ required: true, message: '请选择死亡日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择死亡日期" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="死亡原因"
                name="deathCause"
                rules={[{ required: true, message: '请输入死亡原因' }]}
              >
                <Input placeholder="请输入死亡原因" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="死亡证明编号"
                name="deathCertNumber"
                rules={[{ required: true, message: '请输入死亡证明编号' }]}
              >
                <Input placeholder="请输入死亡证明编号（6-20位字母或数字）" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="死亡证明签发机构"
                name="deathCertIssuer"
                rules={[{ required: true, message: '请输入签发机构' }]}
              >
                <Input placeholder="请输入死亡证明签发机构" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="家属信息" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="家属姓名"
                name="familyName"
                rules={[{ required: true, message: '请输入家属姓名' }]}
              >
                <Input placeholder="请输入家属姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="家属联系电话"
                name="familyPhone"
                rules={[
                  { required: true, message: '请输入联系电话' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位手机号' },
                ]}
              >
                <Input placeholder="请输入11位手机号" maxLength={11} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="与逝者关系"
                name="familyRelation"
                rules={[{ required: true, message: '请选择与逝者关系' }]}
              >
                <Select placeholder="请选择关系">
                  <Option value="配偶">配偶</Option>
                  <Option value="子女">子女</Option>
                  <Option value="父母">父母</Option>
                  <Option value="兄弟姐妹">兄弟姐妹</Option>
                  <Option value="其他亲属">其他亲属</Option>
                  <Option value="朋友">朋友</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="保存安排" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="保存需求"
                name="storageRequirement"
                rules={[{ required: true, message: '请选择保存需求' }]}
              >
                <Select placeholder="请选择冷藏类型">
                  <Option value="NORMAL">普通冷藏（0-4°C）</Option>
                  <Option value="LOW_TEMP">低温冷藏（-15°C以下）</Option>
                  <Option value="SPECIAL">特殊冷藏（定制需求）</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="预计参加人数"
                name="expectedAttendees"
                initialValue={50}
                rules={[{ required: true, message: '请输入预计参加人数' }]}
              >
                <InputNumber min={1} max={500} style={{ width: '100%' }} placeholder="请输入预计参加人数" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="告别偏好" name="ceremonyPreference">
                <Select placeholder="请选择告别偏好（可选）" allowClear>
                  <Option value="SIMPLE">简约仪式</Option>
                  <Option value="TRADITIONAL">传统仪式</Option>
                  <Option value="BUDDHIST">佛教仪式</Option>
                  <Option value="CHRISTIAN">基督教仪式</Option>
                  <Option value="CUSTOM">个性化定制</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={24}>
              <Form.Item label="预计告别时间" name="expectedCeremonyTime">
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  placeholder="选择预计告别仪式时间（可选，用于优化柜位分配）"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <div style={{ textAlign: 'center' }}>
          <Space>
            <Button onClick={() => navigate('/remains')}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              提交录入并分配柜位
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default RemainsCreate;
