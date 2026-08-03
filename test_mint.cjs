// 端到端测试：注册 → 登录 → 创建资产（自动链上 mint）
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const d = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'localhost', port: 8080, path, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const rq = http.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, data: b }); }
      });
    });
    rq.on('error', reject);
    if (d) rq.write(d);
    rq.end();
  });
}

async function main() {
  console.log('=== RWA 端到端测试（含链上 Mint）===\n');

  // 1. 注册
  console.log('1. 注册 issuer...');
  const reg = await req('POST', '/api/auth/register', { email: 'issuer@test.com', password: 'Test123456', role: 'issuer' });
  console.log('  ', reg.status, reg.data.email || reg.data.error);
  const userId = reg.data.id;

  // 2. 登录
  console.log('2. 登录...');
  const login = await req('POST', '/api/auth/login', { email: 'issuer@test.com', password: 'Test123456' });
  console.log('  ', login.status, login.data.token ? 'token=' + login.data.token.slice(0, 20) + '...' : login.data.error);
  const token = login.data.token;

  // 3. 创建资产（触发链上 mint）
  console.log('3. 创建资产（触发链上 mint）...');
  const create = await req('POST', '/api/assets', {
    name: '黄金一号',
    symbol: 'GOLD001',
    asset_type: 'gold',
    total_supply: '1000000',
    price_per_unit: '100.00',
    min_investment: '10000',
    description: '测试黄金资产'
  }, token);
  console.log('  ', create.status, create.data.id ? 'asset_id=' + create.data.id : create.data.error);
  const assetId = create.data.id;

  // 4. 等 3 秒让链上 mint 完成
  console.log('4. 等待链上 mint 完成（3秒）...');
  await new Promise(r => setTimeout(r, 3000));

  // 5. 查看资产详情（应该已经是 live 状态）
  console.log('5. 查看资产详情...');
  const detail = await req('GET', '/api/assets/' + assetId, null, token);
  console.log('  ', detail.status, 'status=' + detail.data.status, 'contract=' + detail.data.contract_address);

  // 6. 列表
  console.log('6. 资产列表...');
  const list = await req('GET', '/api/assets', null, token);
  console.log('  ', list.status, 'total=' + list.data.total, 'count=' + (list.data.data ? list.data.data.length : 0));

  // 7. Live 列表
  console.log('7. Live 列表...');
  const live = await req('GET', '/api/assets/live', null, token);
  console.log('  ', live.status, 'total=' + live.data.total);

  console.log('\n=== 测试完成 ===');
}

main().catch(e => console.error('FATAL:', e.message));
