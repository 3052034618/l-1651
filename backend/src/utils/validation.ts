export const validateIdCard = (idCard: string): { valid: boolean; message?: string; birthDate?: Date; gender?: string } => {
  if (!idCard) {
    return { valid: false, message: '身份证号不能为空' };
  }

  const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  if (!idCardRegex.test(idCard)) {
    return { valid: false, message: '身份证号格式不正确，应为18位有效号码' };
  }

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idCard[i]) * weights[i];
  }
  const checkCode = checkCodes[sum % 11];
  if (checkCode !== idCard[17].toUpperCase()) {
    return { valid: false, message: '身份证号校验位不正确' };
  }

  const year = parseInt(idCard.substring(6, 10));
  const month = parseInt(idCard.substring(10, 12));
  const day = parseInt(idCard.substring(12, 14));
  const birthDate = new Date(year, month - 1, day);

  const genderCode = parseInt(idCard.substring(16, 17));
  const gender = genderCode % 2 === 1 ? 'MALE' : 'FEMALE';

  return { valid: true, birthDate, gender };
};

export const validateDeathCertificate = (certNumber: string, issuer: string): { valid: boolean; message?: string } => {
  if (!certNumber) {
    return { valid: false, message: '死亡证明编号不能为空' };
  }

  if (!issuer) {
    return { valid: false, message: '死亡证明签发机构不能为空' };
  }

  const certRegex = /^[A-Za-z0-9]{6,20}$/;
  if (!certRegex.test(certNumber)) {
    return { valid: false, message: '死亡证明编号格式不正确，应为6-20位字母或数字' };
  }

  if (issuer.length < 2) {
    return { valid: false, message: '死亡证明签发机构名称不完整' };
  }

  return { valid: true };
};

export const validateRemainsInfo = (data: {
  name: string;
  idCardNumber: string;
  deathDate: Date;
  deathCertNumber: string;
  deathCertIssuer: string;
  familyName: string;
  familyPhone: string;
  familyRelation: string;
  deathCause: string;
}): { valid: boolean; messages: string[]; birthDate?: Date; gender?: string } => {
  const messages: string[] = [];

  if (!data.name || data.name.trim().length < 2) {
    messages.push('逝者姓名不能为空且长度至少2个字符');
  }

  if (!data.familyName || data.familyName.trim().length < 2) {
    messages.push('家属姓名不能为空且长度至少2个字符');
  }

  if (!data.familyPhone) {
    messages.push('家属联系电话不能为空');
  } else {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(data.familyPhone)) {
      messages.push('家属联系电话格式不正确，应为11位有效手机号');
    }
  }

  if (!data.familyRelation) {
    messages.push('与逝者关系不能为空');
  }

  if (!data.deathCause) {
    messages.push('死亡原因不能为空');
  }

  if (!data.deathDate) {
    messages.push('死亡时间不能为空');
  } else {
    const deathDate = new Date(data.deathDate);
    if (deathDate > new Date()) {
      messages.push('死亡时间不能晚于当前时间');
    }
  }

  const idCardResult = validateIdCard(data.idCardNumber);
  if (!idCardResult.valid && idCardResult.message) {
    messages.push(idCardResult.message);
  }

  const certResult = validateDeathCertificate(data.deathCertNumber, data.deathCertIssuer);
  if (!certResult.valid && certResult.message) {
    messages.push(certResult.message);
  }

  return {
    valid: messages.length === 0,
    messages,
    birthDate: idCardResult.birthDate,
    gender: idCardResult.gender,
  };
};
