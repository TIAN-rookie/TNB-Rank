-- 为指定 Authentication 用户补建 profile 并授予管理员权限，可重复执行。
insert into public.profiles (id, display_name, role)
select id, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)), 'admin'::public.app_role
from auth.users
where lower(email) = lower('chuhetian99@gmail.com')
on conflict (id) do update set role = 'admin'::public.app_role;

-- 应返回一行且 role 为 admin。
select p.id, u.email, p.display_name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('chuhetian99@gmail.com');
