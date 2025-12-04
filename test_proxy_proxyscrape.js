
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

// Источник SOCKS5-прокси (Proxyscrape)
const proxySource = 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=5000&country=all&ssl=all&anonymity=all';
// Резервный список SOCKS5-прокси (можно расширить)
const fallbackProxies = [
  '51.68.220.240:1080',
  '51.68.220.241:1080',
  '51.68.220.242:1080',
  '51.68.220.243:1080',
  '51.68.220.244:1080',
];

async function loadProxies() {
  try {
    const response = await axios.get(proxySource, { timeout: 10000 });
    const list = response.data.trim().split('\n').filter(Boolean);
    if (list.length > 0) return list;
    console.log('Список с proxyscrape пуст, используем резервный.');
    return fallbackProxies;
  } catch (e) {
    console.log('Ошибка загрузки списка с proxyscrape, используем резервный:', e.message);
    return fallbackProxies;
  }
}

async function testProxy(proxy) {
  const agent = new SocksProxyAgent(`socks5://${proxy}`);
  try {
    const res = await axios.get('https://api.ipify.org?format=json', { httpsAgent: agent, timeout: 8000 });
    console.log(`Прокси: ${proxy} | Ваш IP: ${res.data.ip}`);
    const google = await axios.get('https://www.google.com', { httpsAgent: agent, timeout: 8000 });
    console.log(`Google статус: ${google.status}`);
    return true;
  } catch (e) {
    console.log(`Прокси: ${proxy} | Ошибка: ${e.message}`);
    return false;
  }
}

(async () => {
  const proxies = await loadProxies();
  if (!proxies || proxies.length === 0) {
    console.log('Нет доступных прокси для теста.');
    return;
  }
  for (const proxy of proxies) {
    const ok = await testProxy(proxy);
    if (ok) break;
  }
})();
