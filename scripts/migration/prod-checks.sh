#!/usr/bin/env bash
# Read-only production health/parity checks. Re-run before cutover and compare.
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/migration/pgurl.sh
DB=$(_pgurl)
"$PSQL17" "$DB" -Atc "
select 'db_size: '||pg_size_pretty(pg_database_size(current_database()))
union all select 'auth_users: '||(select count(*) from auth.users)
union all select 'profiles: '||(select count(*) from profiles)
union all select 'users_without_profiles: '||(select count(*) from auth.users u left join profiles p on p.id=u.id where p.id is null)
union all select 'profiles_without_users: '||(select count(*) from profiles p left join auth.users u on u.id=p.id where u.id is null)
union all select 'users_without_subscription: '||(select count(*) from auth.users u left join user_subscriptions s on s.user_id=u.id where s.user_id is null)
union all select 'soft_deleted_users: '||(select count(*) from auth.users where deleted_at is not null)
union all select 'users_with_password: '||(select count(*) from auth.users where encrypted_password is not null and encrypted_password<>'')
union all select 'google_identities: '||(select count(*) from auth.identities where provider='google')
union all select 'unconfirmed_email: '||(select count(*) from auth.users where email_confirmed_at is null and deleted_at is null)
union all select 'applications: '||(select count(*) from applications)
union all select 'fks_into_auth_users: '||(select count(*) from pg_constraint con join pg_class rc on rc.oid=con.confrelid join pg_namespace rn on rn.oid=rc.relnamespace where con.contype='f' and rn.nspname='auth' and rc.relname='users')
union all select 'rls_policies: '||(select count(*) from pg_policies)
union all select 'public_tables: '||(select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r');"
