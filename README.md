# CampusNet 校园网自动认证 App

基于 **Capacitor + TypeScript + Vite** 构建的轻量级 Android 校园网自动登录工具，专为 **Dr.COM ePortal** 网页认证环境设计。零前端框架冗余，本地闭环执行，打开即连。

##  核心特性

- **无感自动认证**：启动 App 或从后台切回前台时自动检测网络状态，断网状态下秒级触发认证。
- **动态 IP 自动提取**：优先通过网关重定向参数提取 `wlanuserip` 与 `wlanacip`，失败时自动读取设备 Wi-Fi 网卡 IPv4 地址兜底。
- **智能状态识别**：自动识别“当前已在线（`ret_code: 2`）”、“认证成功”、“设备数超限（`ret_code: 1`）”等网关状态，避免无效重复请求。
- **纯端侧本地闭环**：所有认证请求直接发往校内局域网网关，账号密码通过 `@capacitor/preferences` 存储在本地设备，不经过任何第三方云端服务器。

##  技术栈

- **构建工具**：Vite + Vanilla TypeScript
- **跨平台运行时**：Capacitor 6 (`@capacitor/core`, `@capacitor/android`)
- **原生能力插件**：
  - `CapacitorHttp`：走原生网络层发送 HTTP GET 请求，绕过 WebView CORS 跨域限制
  - `@capacitor/preferences`：本地持久化存储学号与密码
  - `@capacitor/app`：监听应用前后台切换生命周期
  - `@capgo/capacitor-wifi`：获取当前连接 Wi-Fi 的内网 IPv4 地址

##  使用方法（普通用户）

1. 前往本仓库右侧的 **[发布](../../releases)** 页面下载最新的 `.apk` 安装包并安装。
2. 连接校园网 Wi-Fi（**首次认证建议暂时关闭手机移动数据**，防止系统因探测不到外网将请求路由至蜂窝网络）。
3. 打开 App，输入学号与校园网密码，点击 **保存并立即登录**。
4. 之后每次需要联网时，只需点开 App 即可自动完成认证。

##  本地开发与适配其他高校

如果你所在的学校同样使用城市热点 Dr.COM ePortal 网页认证，只需修改网关地址即可复用：

### 1. 抓包获取本校参数
1. 电脑连接未登录的校园网，打开认证页面并按 `F12` 打开浏览器开发者工具（Network 面板，勾选 `Preserve log`）。
2. 输入账号密码点击登录，找到包含 `c=Portal&a=login` 的 GET 请求。
3. 记录下请求中的网关地址（如 `http://172.16.253.3:801/eportal/`）、`wlan_ac_ip` 以及 `jsVersion`。

### 2. 拉取代码并构建
```bash
# 克隆仓库
git clone [https://github.com/你的用户名/仓库名.git](https://github.com/你的用户名/仓库名.git)
cd 仓库名

# 安装依赖
npm install

# 修改 src/main.ts 中的网关 IP 与默认 AC IP 后，构建并同步至 Android 工程
npm run build && npx cap sync android

# 打开 Android Studio 编译安装
npx cap open android
