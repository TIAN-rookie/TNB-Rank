# TNB 积分天梯

适合小型扑克俱乐部的响应式积分网站，支持手机访问、赛季榜单、单局纪录、选手数据、管理员录入、云端头像和实时同步。

## 两种运行模式

- **本地演示**：`config.js` 保持为空，数据保存在当前浏览器 `localStorage`。
- **云端共享**：填写 Supabase URL 和 anon key，数据由所有设备共享并通过 Realtime 自动更新。

## 本地运行

```bash
python3 -m http.server 8080
```

访问 `http://localhost:8080`。不要直接双击 HTML；云端模块需要通过 HTTP/HTTPS 加载。

## 云端上线

完整步骤见 [`DEPLOY.md`](DEPLOY.md)。数据库结构和权限策略位于：

- `supabase/schema.sql`
- `supabase/bootstrap-admin.sql`

## 权限

- 游客：查看榜单、纪录和选手数据。
- 管理员：注册选手、上传头像、录入赛果。
- Supabase RLS 在数据库层执行权限控制，隐藏前端按钮不是安全边界。
