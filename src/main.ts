import { CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { CapacitorWifi } from '@capgo/capacitor-wifi';

const accountInput = document.getElementById('account') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
const logBox = document.getElementById('logBox') as HTMLPreElement;

let isLoggingIn = false; // 防止重复并发点击

function log(msg: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  logBox.textContent += `\n[${time}] ${msg}`;
  logBox.scrollTop = logBox.scrollHeight;
}

// 0. 检测当前是否已经连通外网（利用鸿蒙/MIUI 204 探针）
async function checkInternetConnected(): Promise<boolean> {
  try {
    const res = await CapacitorHttp.get({
      url: 'http://connect.rom.miui.com/generate_204',
      connectTimeout: 2000,
      readTimeout: 2000,
    });
    // 未登录校园网时会被网关 302 重定向到 172.16.253.3，不会返回 204
    return res.status === 204;
  } catch {
    return false;
  }
}

// 1. 动态获取本机内网 IP
async function getDeviceNetworkInfo(): Promise<{ userIp: string; acIp: string }> {
  try {
    const probe = await CapacitorHttp.get({
      url: 'http://172.16.253.3/',
      connectTimeout: 3000,
    });
    const urlObj = new URL(probe.url);
    const redirectIp = urlObj.searchParams.get('wlanuserip');
    const redirectAc = urlObj.searchParams.get('wlanacip');
    if (redirectIp) {
      return { userIp: redirectIp, acIp: redirectAc || '172.16.253.1' };
    }
  } catch {
    // 转入网卡读取兜底
  }

  const wifiInfo = await CapacitorWifi.getIpAddress();
  if (!wifiInfo.ipAddress || wifiInfo.ipAddress === '0.0.0.0') {
    throw new Error('未获取到有效 Wi-Fi IP，请确认已连接校园网且关闭移动数据');
  }
  return { userIp: wifiInfo.ipAddress, acIp: '172.16.253.1' };
}

// 2. 执行 Dr.COM ePortal 认证请求
async function doLogin(force = false) {
  if (isLoggingIn) return;
  const account = accountInput.value.trim();
  const password = passwordInput.value;

  if (!account || !password) {
    log('请先填写学号和密码');
    return;
  }

  isLoggingIn = true;
  try {
    if (!force) {
      const online = await checkInternetConnected();
      if (online) {
        log('✅ 当前已接入互联网，无需重复登录');
        return;
      }
    }

    log('正在获取内网 IP...');
    const { userIp, acIp } = await getDeviceNetworkInfo();
    log(`本机 IP: ${userIp} | AC: ${acIp}`);

    const randomV = Math.floor(Math.random() * 9000 + 1000).toString();
    const res = await CapacitorHttp.get({
      url: 'http://172.16.253.3:801/eportal/',
      headers: {
        Referer: 'http://172.16.253.3/',
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
      params: {
        c: 'Portal',
        a: 'login',
        callback: 'dr1003',
        login_method: '1',
        user_account: account,
        user_password: password,
        wlan_user_ip: userIp,
        wlan_user_ipv6: '',
        wlan_user_mac: '000000000000',
        wlan_ac_ip: acIp,
        wlan_ac_name: '',
        jsVersion: '3.3.2',
        v: randomV,
      },
    });

    const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const match = raw.match(/^dr1003\((.*)\)$/);
    if (!match) {
      log(`响应异常: ${raw}`);
      return;
    }

    const parsed = JSON.parse(match[1]);
    if (parsed.result === '1' || parsed.result === 1) {
      log(`✅ 登录成功: ${parsed.msg || '已接入互联网'}`);
    } else if (parsed.ret_code === 2) {
      log('✅ 当前设备已在线（网关返回 ret_code: 2）');
    } else if (parsed.ret_code === 1) {
      log(`❌ 登录受限: 账号密码错误或在线设备数已达上限 (${parsed.msg || 'ret_code: 1'})`);
    } else {
      log(`❌ 登录失败: ${parsed.msg || raw}`);
    }
  } catch (err: any) {
    log(`⚠️ 请求异常: ${err?.message || String(err)}`);
  } finally {
    isLoggingIn = false;
  }
}

// 3. 初始化加载本地保存的账号并自动触发登录
async function init() {
  logBox.textContent = '准备就绪';
  const savedAcc = await Preferences.get({ key: 'account' });
  const savedPwd = await Preferences.get({ key: 'password' });

  if (savedAcc.value) accountInput.value = savedAcc.value;
  if (savedPwd.value) passwordInput.value = savedPwd.value;

  if (savedAcc.value && savedPwd.value) {
    log('检测到已保存账号，正在检查网络状态...');
    await doLogin();
  }
}

loginBtn.addEventListener('click', async () => {
  await Preferences.set({ key: 'account', value: accountInput.value.trim() });
  await Preferences.set({ key: 'password', value: passwordInput.value });
  log('账号密码已保存');
  await doLogin(true); // 手动点击按钮时强制执行一次认证
});

App.addListener('appStateChange', ({ isActive }) => {
  if (isActive && accountInput.value && passwordInput.value) {
    log('App 回到前台，检查网络状态...');
    doLogin();
  }
});

init();