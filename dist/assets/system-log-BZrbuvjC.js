import{o as e}from"./rolldown-runtime-C0FnF6B9.js";import{N as t}from"./index-BFIBYwc9.js";import{n,t as r}from"./db-wIEXC_2c.js";var i=e(n()),a=!1;async function o(){a||=(await r`
    CREATE TABLE IF NOT EXISTS system_log_groups (
      id BIGSERIAL PRIMARY KEY,
      fingerprint VARCHAR(64) NOT NULL UNIQUE,
      title VARCHAR(500) NOT NULL,
      severity VARCHAR(16) NOT NULL DEFAULT 'error',
      category VARCHAR(32) NOT NULL,
      module_name VARCHAR(100),
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      affected_user_count INTEGER NOT NULL DEFAULT 0,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      assigned_to VARCHAR(255),
      resolution_notes TEXT,
      resolved_at TIMESTAMPTZ,
      resolved_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,await r`
    CREATE TABLE IF NOT EXISTS system_logs (
      id BIGSERIAL PRIMARY KEY,
      log_id VARCHAR(36) NOT NULL UNIQUE,
      group_id BIGINT REFERENCES system_log_groups(id) ON DELETE SET NULL,
      fingerprint VARCHAR(64),
      environment VARCHAR(32) NOT NULL DEFAULT 'production',
      severity VARCHAR(16) NOT NULL,
      category VARCHAR(32) NOT NULL,
      title VARCHAR(500),
      description TEXT,
      error_message TEXT,
      stack_trace TEXT,
      module_name VARCHAR(100),
      feature_name VARCHAR(100),
      page_url TEXT,
      route VARCHAR(500),
      api_endpoint VARCHAR(500),
      http_method VARCHAR(16),
      http_status_code INTEGER,
      user_id VARCHAR(64),
      user_name VARCHAR(255),
      user_role VARCHAR(64),
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      course_name VARCHAR(255),
      browser VARCHAR(100),
      operating_system VARCHAR(100),
      device_type VARCHAR(64),
      screen_resolution VARCHAR(32),
      ip_address VARCHAR(45),
      session_id VARCHAR(128),
      execution_time_ms INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      root_cause_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC)`,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity)`,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category)`,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs(module_name)`,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_fingerprint ON system_logs(fingerprint)`,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_group ON system_logs(group_id)`,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs(user_id)`,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_course ON system_logs(course_id)`,await r`CREATE INDEX IF NOT EXISTS idx_system_logs_environment ON system_logs(environment)`,await r`CREATE INDEX IF NOT EXISTS idx_system_log_groups_status ON system_log_groups(status)`,await r`CREATE INDEX IF NOT EXISTS idx_system_log_groups_last_seen ON system_log_groups(last_seen_at DESC)`,await r`
    UPDATE system_log_groups
    SET status = 'open', updated_at = NOW()
    WHERE status IN ('active', 'ignored')
  `,!0)}function s(){return{NODE_ENV:`production`,VITE_API_URL:`https://course-collab.com`,VITE_DEV_SERVER_URL:`http://127.0.0.1:5173`,CURSOR_REQUEST_ID:`4b377858-7a47-4d46-89b7-b6bff6d83baf`,_ZO_DOCTOR:`0`,VSCODE_CRASH_REPORTER_PROCESS_TYPE:`extensionHost`,NODE:`/usr/local/bin/node`,INIT_CWD:`/Users/danieldoe/Downloads/coursecollab-desktop`,TERM:`dumb`,SHELL:`/bin/zsh`,VSCODE_PROCESS_TITLE:`extension-host (agent-exec) coursecollab-desktop [2-22]`,TMPDIR:`/var/folders/k0/_8dkvpp96v5cnjkk25qlqt3r0000gn/T/`,HOMEBREW_REPOSITORY:`/opt/homebrew`,npm_config_global_prefix:`/Users/danieldoe/.npm-global`,FPATH:`/opt/homebrew/share/zsh/site-functions:/opt/homebrew/share/zsh/site-functions:/usr/local/share/zsh/site-functions:/usr/share/zsh/site-functions:/usr/share/zsh/5.9/functions`,CURSOR_WORKSPACE_LABEL:`coursecollab-desktop`,MallocNanoZone:`0`,COLOR:`0`,NO_COLOR:`1`,npm_config_noproxy:``,npm_config_local_prefix:`/Users/danieldoe/Downloads/coursecollab-desktop`,CURSOR_LAYOUT:`unifiedAgent`,CURSOR_CONVERSATION_ID:`645b0795-64fa-4c08-8e81-0d1daa458de4`,USER:`danieldoe`,COMMAND_MODE:`unix2003`,npm_config_globalconfig:`/Users/danieldoe/.npm-global/etc/npmrc`,SSH_AUTH_SOCK:`/var/run/com.apple.launchd.JtkW1FGA2l/Listeners`,CURSOR_AGENT_STORE_SHARED_PATHS:`{"user":{"path":"/Users/danieldoe/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/u297751068/files","readOnly":false}}`,__CF_USER_TEXT_ENCODING:`0x1F5:0x0:0x0`,npm_execpath:`/usr/local/lib/node_modules/npm/bin/npm-cli.js`,PATH:`/Users/danieldoe/Downloads/coursecollab-desktop/node_modules/.bin:/Users/danieldoe/Downloads/node_modules/.bin:/Users/danieldoe/node_modules/.bin:/Users/node_modules/.bin:/node_modules/.bin:/usr/local/lib/node_modules/npm/node_modules/@npmcli/run-script/lib/node-gyp-bin:/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/System/Cryptexes/App/usr/bin:/usr/bin:/bin:/usr/sbin:/sbin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/local/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/appleinternal/bin:/pkg/env/global/bin:/Library/Apple/usr/bin:/Applications/Cursor.app/Contents/Resources/app/node_modules/@vscode/ripgrep/bin:/opt/homebrew/opt/openjdk@21/bin:/Users/danieldoe/.npm-global/bin:/Users/danieldoe/.maestro/bin:/Users/danieldoe/.npm-global/bin:/Users/danieldoe/.maestro/bin`,npm_package_json:`/Users/danieldoe/Downloads/coursecollab-desktop/package.json`,npm_config_userconfig:`/Users/danieldoe/.npmrc`,npm_config_init_module:`/Users/danieldoe/.npm-init.js`,__CFBundleIdentifier:`com.todesktop.230313mzl4w4u92`,npm_command:`run-script`,PWD:`/Users/danieldoe/Downloads/coursecollab-desktop`,VSCODE_HANDLES_UNCAUGHT_ERRORS:`true`,JAVA_HOME:`/opt/homebrew/opt/openjdk@21`,npm_lifecycle_event:`build:desktop:mac`,EDITOR:`vi`,VSCODE_ESM_ENTRYPOINT:`vs/workbench/api/node/extensionHostProcess`,npm_package_name:`coursecollab-desktop`,CURSOR_AGENT:`1`,LANG:`C.UTF-8`,CURSOR_AGENT_STORE_FILES_DIR:`/Users/danieldoe/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/645b0795-64fa-4c08-8e81-0d1daa458de4/files`,npm_config_npm_version:`10.9.3`,XPC_FLAGS:`0x0`,CURSOR_EXTENSION_HOST_ROLE:`agent-exec`,FORCE_COLOR:`0`,MACH_PORT_RENDEZVOUS_PEER_VALDATION:`1`,npm_config_node_gyp:`/usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js`,npm_package_version:`0.1.3`,XPC_SERVICE_NAME:`0`,SHLVL:`2`,HOME:`/Users/danieldoe`,VSCODE_NLS_CONFIG:`{"userLocale":"en-us","osLocale":"en-us","resolvedLanguage":"en","defaultMessagesFile":"/Applications/Cursor.app/Contents/Resources/app/out/nls.messages.json","locale":"en-us","availableLanguages":{}}`,HOMEBREW_PREFIX:`/opt/homebrew`,npm_config_cache:`/Users/danieldoe/.npm`,LOGNAME:`danieldoe`,npm_lifecycle_script:`npm run sync:notification-groups && python3 scripts/prepare-desktop-icons.py && vite build && tsc -p tsconfig.electron.json && node scripts/copy-electron-setup.mjs && node scripts/rebuild-electron-native.mjs && electron-builder --mac --publish never`,CURSOR_RIPGREP_PATH:`/Applications/Cursor.app/Contents/Resources/app/node_modules/@vscode/ripgrep/bin/rg`,VSCODE_IPC_HOOK:`/Users/danieldoe/Library/Application Support/Cursor/3.19-main.sock`,VSCODE_CODE_CACHE_PATH:`/Users/danieldoe/Library/Application Support/Cursor/CachedData/dd066f332fcea7382764400fde902f61920648d0`,npm_config_user_agent:`npm/10.9.3 node/v22.20.0 darwin arm64 workspaces/false`,VSCODE_PID:`69341`,INFOPATH:`/opt/homebrew/share/info:/opt/homebrew/share/info:`,HOMEBREW_CELLAR:`/opt/homebrew/Cellar`,AGENT_TRANSCRIPTS:`/Users/danieldoe/.cursor/projects/Users-danieldoe-Downloads-coursecollab-desktop/agent-transcripts`,OSLogRateLimit:`64`,VSCODE_CWD:`/`,npm_node_execpath:`/usr/local/bin/node`,npm_config_prefix:`/Users/danieldoe/.npm-global`,__CURSOR_SANDBOX_ENV_RESTORE:`builtin unset CURSOR_CONVERSATION_ID CURSOR_REQUEST_ID CURSOR_AGENT_STORE_FILES_DIR CURSOR_AGENT_STORE_SHARED_PATHS 2>/dev/null || true; builtin export CURSOR_CONVERSATION_ID='645b0795-64fa-4c08-8e81-0d1daa458de4'; builtin export CURSOR_REQUEST_ID='4b377858-7a47-4d46-89b7-b6bff6d83baf'; builtin export CURSOR_AGENT_STORE_FILES_DIR='/Users/danieldoe/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/645b0795-64fa-4c08-8e81-0d1daa458de4/files'; builtin export CURSOR_AGENT_STORE_SHARED_PATHS='{"user":{"path":"/Users/danieldoe/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/u297751068/files","readOnly":false}}'`,_:`/Users/danieldoe/Downloads/coursecollab-desktop/node_modules/.bin/vite`}.VERCEL_ENV||`production`}function c(e){let t=e.stackTrace?.split(`
`).find(e=>e.trim())?.trim()??``,n=[e.category,e.moduleName??``,e.apiEndpoint??``,(e.errorMessage??``).slice(0,300),t.slice(0,200)].join(`|`);return(0,i.createHash)(`sha256`).update(n).digest(`hex`).slice(0,32)}function l(e){let t=[],n=(e.errorMessage??``).toLowerCase(),r=(e.stackTrace??``).toLowerCase();return(e.httpStatusCode===401||n.includes(`unauthorized`))&&t.push(`Authentication token may be missing or expired`),(e.httpStatusCode===403||n.includes(`forbidden`)||n.includes(`permission`))&&t.push(`User may lack required role or course permission`),(e.httpStatusCode===404||n.includes(`not found`))&&t.push(`Referenced resource may have been deleted or ID is invalid`),(e.httpStatusCode===409||n.includes(`duplicate`)||n.includes(`unique constraint`))&&t.push(`Duplicate record or unique constraint violation`),e.httpStatusCode===429&&t.push(`Rate limit exceeded — consider throttling or retry backoff`),(n.includes(`timeout`)||n.includes(`statement_timeout`))&&t.push(`Database or API query exceeded timeout threshold`),n.includes(`connection`)&&(n.includes(`refused`)||n.includes(`terminated`))&&t.push(`Database connection failure — check DATABASE_URL and pool health`),n.includes(`foreign key`)&&t.push(`Foreign key constraint — parent record may be missing`),n.includes(`hydration`)&&t.push(`React hydration mismatch — server/client HTML differs`),(r.includes(`chunkloaderror`)||n.includes(`loading chunk`))&&t.push(`Stale deployment — user may need hard refresh after deploy`),e.category===`storage`&&t.push(`File storage provider or upload configuration issue`),e.category===`email`&&t.push(`SMTP or email delivery service configuration issue`),[...new Set([...e.rootCauseHints??[],...t])]}function u(e){return e.title?.trim()?e.title.trim():e.errorMessage?.trim()?e.errorMessage.trim().slice(0,200):`${e.category} ${e.severity}`.replace(/^\w/,e=>e.toUpperCase())}async function d(e,t,n){let i=await r`
    SELECT id, affected_user_count, status FROM system_log_groups WHERE fingerprint = ${e} LIMIT 1
  `;if(i.length===0)return null;let a=Number(i[0].id),o=Number(i[0].affected_user_count),s=0;if(n.userId){let[t]=await r`
      SELECT 1 FROM system_logs
      WHERE fingerprint = ${e} AND user_id = ${n.userId}
      LIMIT 1
    `;t||(s=1)}let c=String(i[0].status),l=n.onRecurrence===`reopen_resolved`&&c===`resolved`,u=n.onRecurrence===`needs_attention`&&(c===`resolved`||c===`open`);return await r`
    UPDATE system_log_groups SET
      occurrence_count = occurrence_count + 1,
      affected_user_count = ${o+s},
      last_seen_at = NOW(),
      severity = CASE
        WHEN ${t.severity} = 'critical' THEN 'critical'
        WHEN severity = 'critical' THEN 'critical'
        WHEN ${t.severity} = 'error' AND severity NOT IN ('critical') THEN 'error'
        ELSE severity
      END,
      status = CASE
        WHEN ${u} THEN 'needs_attention'
        WHEN ${l} THEN 'open'
        ELSE status
      END,
      resolved_at = CASE
        WHEN ${u} OR ${l} THEN NULL
        ELSE resolved_at
      END,
      resolved_by = CASE
        WHEN ${u} OR ${l} THEN NULL
        ELSE resolved_by
      END,
      updated_at = NOW()
    WHERE id = ${a}
  `,a}async function f(e,t,n,i){let a=i?.initialStatus??`open`,o=i?.onRecurrence??`reopen_resolved`,s=t.userId?.trim()||null,c=await d(e,t,{onRecurrence:o,userId:s});if(c!=null)return c;try{let[i]=await r`
      INSERT INTO system_log_groups (
        fingerprint, title, severity, category, module_name,
        occurrence_count, affected_user_count, first_seen_at, last_seen_at, status
      ) VALUES (
        ${e},
        ${n},
        ${t.severity},
        ${t.category},
        ${t.moduleName??null},
        1,
        ${+!!s},
        NOW(),
        NOW(),
        ${a}
      )
      RETURNING id
    `;return i?Number(i.id):null}catch(n){if((n&&typeof n==`object`&&`code`in n?String(n.code):void 0)===`23505`)return d(e,t,{onRecurrence:o,userId:s});throw n}}async function p(e){try{await o();let n=(0,i.randomUUID)(),a=u(e),d=t(e),p=e.groupFingerprint??c({category:e.category,moduleName:e.moduleName,apiEndpoint:e.apiEndpoint,errorMessage:e.errorMessage,stackTrace:e.stackTrace}),m=l(e),h=JSON.stringify(e.metadata??{}),g=JSON.stringify(m),_=e.environment??s(),v=e.alwaysGroup||e.severity===`error`||e.severity===`critical`||e.groupStatus===`needs_attention`?await f(p,e,a,{initialStatus:e.groupStatus??`open`,onRecurrence:e.groupOnRecurrence??`reopen_resolved`}):null;return await r`
      INSERT INTO system_logs (
        log_id, group_id, fingerprint, environment, severity, category,
        title, description, error_message, stack_trace,
        module_name, feature_name, page_url, route,
        api_endpoint, http_method, http_status_code,
        user_id, user_name, user_role, course_id, course_name,
        browser, operating_system, device_type, screen_resolution,
        ip_address, session_id, execution_time_ms,
        metadata, root_cause_hints, user_agent
      ) VALUES (
        ${n},
        ${v},
        ${p},
        ${_},
        ${e.severity},
        ${e.category},
        ${a},
        ${d},
        ${e.errorMessage??null},
        ${e.stackTrace??null},
        ${e.moduleName??null},
        ${e.featureName??null},
        ${e.pageUrl??null},
        ${e.route??null},
        ${e.apiEndpoint??null},
        ${e.httpMethod??null},
        ${e.httpStatusCode??null},
        ${e.userId??null},
        ${e.userName??null},
        ${e.userRole??null},
        ${e.courseId??null},
        ${e.courseName??null},
        ${e.browser??null},
        ${e.operatingSystem??null},
        ${e.deviceType??null},
        ${e.screenResolution??null},
        ${e.ipAddress??null},
        ${e.sessionId??null},
        ${e.executionTimeMs??null},
        ${h}::jsonb,
        ${g}::jsonb,
        ${e.userAgent??null}
      )
      ON CONFLICT (log_id) DO NOTHING
    `,n}catch(e){return console.warn(`[system-log] insert failed`,e),null}}function m(e){if(e instanceof Error)return e.message;if(typeof e==`string`)return e;try{return JSON.stringify(e)}catch{return`Unknown error`}}function h(e){return e instanceof Error&&e.stack?e.stack:null}function g(e,t){let n=m(e),r=e&&typeof e==`object`&&`code`in e?String(e.code):void 0,i=String(t?.metadata?.queryPreview??``);return!!(r===`42703`&&n.includes(`deleted_at`)||r===`42703`&&n.includes(`created_at`)&&i.includes(`practice_attempts`)||r===`42703`&&n.includes(`lecture_workspace`)||r===`42703`&&n.includes(`completed`)&&i.includes(`playground_results`)||r===`22003`&&i.includes(`playground_results`)&&i.includes(`completed_at`)||r===`23505`&&n.includes(`system_log_groups_fingerprint_key`)||r===`42P01`&&i.includes(`attempt_creation_audit`)||i.includes(`update_student_learning_profile`)&&n.includes(`completed`)||i.includes(`generate_quiz_report`)&&(r===`57014`||n.toLowerCase().includes(`timeout`))||i.includes(`save_learning_report`)&&(r===`57014`||n.toLowerCase().includes(`timeout`))||r===`42P01`&&i.includes(`student_answer_backup`)||r===`42883`&&n.includes(`digest`)||r===`42703`&&i.includes(`quiz_attempts`)&&n.includes(`is_finalized`)||r===`42703`&&i.includes(`quizzes`)&&n.includes(`anti_cheat_config`)||r===`42P01`&&i.includes(`classroom_submissions`)||r===`42703`&&i.includes(`classroom_point_submissions`)&&n.includes(`active`)||r===`23503`&&n.includes(`student_learning_profile_student_id_fkey`)&&i.includes(`playground_results`)||r===`42P01`&&i.includes(`practice_hub_attempts`)||r===`42703`&&i.includes(`quizzes`)&&n.includes(`is_active`)||r===`42703`&&i.includes(`quiz_questions`)&&n.includes(`updated_at`)||r===`42702`&&i.includes(`attendance_streaks`)&&n.includes(`ambiguous`)||r===`42P01`&&i.includes(`platform_activity_log`)||r===`42703`&&i.includes(`password_reset_requests`)&&n.includes(`full_name`)||r===`42703`&&i.includes(`circuit_spec`)||r===`42703`&&i.includes(`pdf_blob_url`)||r===`42703`&&i.includes(`week_number`)&&i.includes(`lectures`)||r===`42703`&&i.includes(`activity_type`)&&i.includes(`student_activity_points`)||n.includes(`fetch failed`)&&i.includes(`system_log_groups`)||n.toLowerCase().includes(`timeout`)&&(i.includes(`system_log_groups`)||i.includes(`system_logs`)))}async function _(e,t){if(g(e,t))return;let n=m(e),r=h(e),i=e&&typeof e==`object`&&`code`in e?String(e.code):void 0;await p({severity:n.toLowerCase().includes(`timeout`)?`critical`:`error`,category:`database`,title:t?.operation?`Database error: ${t.operation}`:`Database error`,errorMessage:n,stackTrace:r,moduleName:t?.moduleName??`Platform Module`,featureName:t?.table??void 0,metadata:{operation:t?.operation,table:t?.table,errorCode:i,...t?.metadata??{}},rootCauseHints:i?[`PostgreSQL error code: ${i}`]:void 0})}export{_ as logDatabaseError};