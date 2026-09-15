# TNB 积分站上线指南

## 1. 创建 Supabase 项目

1. 登录 [Supabase](https://supabase.com)，创建一个项目并保存数据库密码。
2. 打开 **SQL Editor**，复制并执行 `supabase/schema.sql`。
3. 打开 **Authentication → Users → Add user**，创建管理员邮箱和密码。
4. 编辑 `supabase/bootstrap-admin.sql`，把示例邮箱换成管理员邮箱，然后在 SQL Editor 执行。
5. 打开 **Project Settings → API**，复制 Project URL 和 anon/public key。

注意：不要把 `service_role` key 放进网页。前端只允许使用 anon key，数据安全由 `schema.sql` 中的 RLS 策略保证。

## 2. 配置网站

编辑 `config.js`：

```js
window.TNB_CONFIG = {
  supabaseUrl: 'https://你的项目.supabase.co',
  supabaseAnonKey: '你的 anon public key'
};
```

配置为空时，网站继续使用浏览器本地演示数据；配置完整时，自动切换到云端共享模式。

## 3. 本地验收

```bash
python3 -m http.server 8080
```

打开 `http://localhost:8080`，检查：

- 顶部状态显示“云端实时”。
- 未登录时只能查看数据。
- 管理员登录后出现“注册选手”和“录入赛果”。
- 一台设备录入赛果，另一台设备页面无需刷新即可更新。
- 手机浏览器可正常打开、切换赛季和查看榜单。

## 4. 发布到 Vercel

1. 将项目上传到 GitHub 私有仓库。
2. 登录 [Vercel](https://vercel.com)，选择 **Add New → Project** 并导入仓库。
3. Framework Preset 选择 **Other**，无需 Build Command，Output Directory 保持 `.`。
4. 点击 Deploy，完成后会得到 `https://项目名.vercel.app` 地址。
5. 在手机上打开该 HTTPS 地址测试。

更新代码并推送到 GitHub 后，Vercel 会自动重新发布。

## 5. 正式使用建议

- Supabase Authentication 中关闭公开注册，只由项目所有者创建管理员账号。
- 至少保留两个管理员账号，避免单个账号遗失。
- 定期在 Supabase 导出 `players`、`games` 和 `game_results` 表。
- 修改赛果、撤销赛果和操作日志尚未包含在当前版本，正式长期使用前建议继续补充。
