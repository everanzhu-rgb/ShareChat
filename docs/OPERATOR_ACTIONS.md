# 需要拥有者完成的外部操作

## 当前不阻塞本地开发

### Apple 登录

需要在 Apple Developer 后台准备：App ID、Services ID、Team ID、Key ID、私钥、注册域名 `qijian.everanz.com`，以及回调 `https://qijian.everanz.com/api/auth/callback/apple`。

### Cloudflare

需要新建 `qijian-prod` Tunnel，并只新增 `qijian.everanz.com` 公网主机名。真实变更尚未执行。

### iPhone 真机

自动化完成后仍需在真实 iPhone 上检查主屏幕安装、推送、设备验证、相册、麦克风、定位、切后台、飞行模式和大视频。
