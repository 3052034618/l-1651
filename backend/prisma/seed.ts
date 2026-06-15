import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      realName: '系统管理员',
      role: 'ADMIN',
      phone: '13800138000',
      skills: '系统管理,权限管理',
      maxWorkHours: 8,
    },
  });

  await prisma.user.upsert({
    where: { username: 'supervisor' },
    update: {},
    create: {
      username: 'supervisor',
      password: hashedPassword,
      realName: '张主管',
      role: 'SUPERVISOR',
      phone: '13800138001',
      skills: '审批管理,排程管理',
      maxWorkHours: 8,
    },
  });

  await prisma.user.upsert({
    where: { username: 'host01' },
    update: {},
    create: {
      username: 'host01',
      password: hashedPassword,
      realName: '李司仪',
      role: 'HOST',
      phone: '13800138002',
      skills: '告别司仪,一级资质',
      maxWorkHours: 8,
    },
  });

  await prisma.user.upsert({
    where: { username: 'host02' },
    update: {},
    create: {
      username: 'host02',
      password: hashedPassword,
      realName: '王司仪',
      role: 'HOST',
      phone: '13800138009',
      skills: '告别司仪,二级资质',
      maxWorkHours: 8,
    },
  });

  await prisma.user.upsert({
    where: { username: 'cremator01' },
    update: {},
    create: {
      username: 'cremator01',
      password: hashedPassword,
      realName: '王火化员',
      role: 'CREMATOR',
      phone: '13800138003',
      skills: '火化操作,设备维护',
      maxWorkHours: 8,
    },
  });

  await prisma.user.upsert({
    where: { username: 'reception01' },
    update: {},
    create: {
      username: 'reception01',
      password: hashedPassword,
      realName: '赵接待员',
      role: 'RECEPTION',
      phone: '13800138004',
      skills: '前台接待,信息录入',
      maxWorkHours: 8,
    },
  });

  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 10; col++) {
      const type = row <= 2 ? 'NORMAL' : row <= 4 ? 'LOW_TEMP' : 'SPECIAL';
      await prisma.storageCabinet.upsert({
        where: { cabinetNo: `C${row}-${col.toString().padStart(2, '0')}` },
        update: {},
        create: {
          cabinetNo: `C${row}-${col.toString().padStart(2, '0')}`,
          row,
          col,
          type,
          temperature: type === 'LOW_TEMP' ? -18 : type === 'SPECIAL' ? -25 : 4,
        },
      });
    }
  }

  const halls = [
    { hallNo: 'H01', name: '一号告别厅', capacity: 100, facilities: '音响,投影,鲜花台' },
    { hallNo: 'H02', name: '二号告别厅', capacity: 60, facilities: '音响,投影' },
    { hallNo: 'H03', name: '三号告别厅', capacity: 30, facilities: '音响' },
    { hallNo: 'H04', name: '四号告别厅', capacity: 20, facilities: '音响' },
  ];
  for (const hall of halls) {
    await prisma.ceremonyHall.upsert({
      where: { hallNo: hall.hallNo },
      update: {},
      create: hall,
    });
  }

  const furnaces = [
    { furnaceNo: 'F01', type: 'TYPE_A', fuelLevel: 100 },
    { furnaceNo: 'F02', type: 'TYPE_A', fuelLevel: 85 },
    { furnaceNo: 'F03', type: 'TYPE_B', fuelLevel: 92 },
    { furnaceNo: 'F04', type: 'TYPE_C', fuelLevel: 78 },
  ];
  for (const f of furnaces) {
    await prisma.cremationFurnace.upsert({
      where: { furnaceNo: f.furnaceNo },
      update: {},
      create: f,
    });
  }

  for (let area = 1; area <= 3; area++) {
    for (let row = 1; row <= 10; row++) {
      for (let col = 1; col <= 8; col++) {
        const level = area === 1 ? 'NORMAL' : area === 2 ? 'DELUXE' : 'PREMIUM';
        const price = level === 'NORMAL' ? 5000 : level === 'DELUXE' ? 15000 : 50000;
        await prisma.ashesNiche.upsert({
          where: { nicheNo: `A${area}-R${row}-C${col.toString().padStart(2, '0')}` },
          update: {},
          create: {
            nicheNo: `A${area}-R${row}-C${col.toString().padStart(2, '0')}`,
            area: `A区${area}`,
            row,
            col,
            level,
            price,
          },
        });
      }
    }
  }

  const feeItems = [
    { id: 'TRANSPORT_市内接运', category: 'TRANSPORT', name: '遗体接运（市内）', price: 500, unit: '次', description: '市区范围内遗体接运服务' },
    { id: 'TRANSPORT_长途接运', category: 'TRANSPORT', name: '遗体接运（长途）', price: 2000, unit: '次', description: '跨市遗体接运服务' },
    { id: 'STORAGE_普通冷藏', category: 'STORAGE', name: '普通冷藏', price: 200, unit: '天', description: '普通冷藏柜每日费用' },
    { id: 'STORAGE_低温冷藏', category: 'STORAGE', name: '低温冷藏', price: 400, unit: '天', description: '低温冷藏柜每日费用' },
    { id: 'STORAGE_特殊冷藏', category: 'STORAGE', name: '特殊冷藏', price: 800, unit: '天', description: '特殊冷藏柜每日费用' },
    { id: 'CEREMONY_一号厅', category: 'CEREMONY', name: '一号告别厅使用费', price: 3000, unit: '次', description: '可容纳100人' },
    { id: 'CEREMONY_二号厅', category: 'CEREMONY', name: '二号告别厅使用费', price: 2000, unit: '次', description: '可容纳60人' },
    { id: 'CEREMONY_三号厅', category: 'CEREMONY', name: '三号告别厅使用费', price: 1000, unit: '次', description: '可容纳30人' },
    { id: 'CEREMONY_四号厅', category: 'CEREMONY', name: '四号告别厅使用费', price: 600, unit: '次', description: '可容纳20人' },
    { id: 'CEREMONY_司仪服务', category: 'CEREMONY', name: '司仪服务费', price: 800, unit: '次', description: '专业司仪主持告别仪式' },
    { id: 'CREMATION_A型炉', category: 'CREMATION', name: '火化费（A型炉）', price: 1500, unit: '次', description: 'A型火化炉火化服务' },
    { id: 'CREMATION_B型炉', category: 'CREMATION', name: '火化费（B型炉）', price: 2000, unit: '次', description: 'B型火化炉火化服务' },
    { id: 'CREMATION_C型炉', category: 'CREMATION', name: '火化费（C型炉）', price: 3500, unit: '次', description: 'C型豪华火化炉火化服务' },
    { id: 'NICHE_普通格位', category: 'NICHE_STORAGE', name: '普通格位（年）', price: 500, unit: '年', description: '普通区骨灰格位年费' },
    { id: 'NICHE_豪华格位', category: 'NICHE_STORAGE', name: '豪华格位（年）', price: 1500, unit: '年', description: '豪华区骨灰格位年费' },
    { id: 'NICHE_尊享格位', category: 'NICHE_STORAGE', name: '尊享格位（年）', price: 5000, unit: '年', description: '尊享区骨灰格位年费' },
    { id: 'OTHER_骨灰盒普通', category: 'OTHER', name: '骨灰盒（普通）', price: 800, unit: '个', description: '普通木质骨灰盒' },
    { id: 'OTHER_骨灰盒高档', category: 'OTHER', name: '骨灰盒（高档）', price: 3800, unit: '个', description: '高档红木骨灰盒' },
    { id: 'OTHER_消毒服务', category: 'OTHER', name: '消毒服务费', price: 100, unit: '次', description: '遗体消毒处理' },
    { id: 'OTHER_整容服务', category: 'OTHER', name: '整容服务费', price: 500, unit: '次', description: '遗体整容化妆服务' },
  ];
  for (const item of feeItems) {
    await prisma.feeItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }

  console.log('种子数据创建完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
