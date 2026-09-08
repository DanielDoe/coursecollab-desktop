import{Q as e}from"./index-Bk6sIswz.js";import{n as t,t as n}from"./db-CaZqfTPZ.js";var r=t(),i=!1;async function a(){i||=(await n`
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
  `,await n`
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
  `,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC)`,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity)`,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category)`,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs(module_name)`,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_fingerprint ON system_logs(fingerprint)`,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_group ON system_logs(group_id)`,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs(user_id)`,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_course ON system_logs(course_id)`,await n`CREATE INDEX IF NOT EXISTS idx_system_logs_environment ON system_logs(environment)`,await n`CREATE INDEX IF NOT EXISTS idx_system_log_groups_status ON system_log_groups(status)`,await n`CREATE INDEX IF NOT EXISTS idx_system_log_groups_last_seen ON system_log_groups(last_seen_at DESC)`,await n`
    UPDATE system_log_groups
    SET status = 'open', updated_at = NOW()
    WHERE status IN ('active', 'ignored')
  `,!0)}function o(){return{NODE_ENV:`production`,VITE_API_URL:`https://course-collab.com`,VITE_DEV_SERVER_URL:`http://127.0.0.1:5173`,ACSetupSvcPort:`23210`,ACSvcPort:`17532`,AGENT_TRANSCRIPTS:`C:\\Users\\danie\\.cursor\\projects\\c-Users-danie-Downloads-coursecollab-desktop\\agent-transcripts`,ALLUSERSPROFILE:`C:\\ProgramData`,APPDATA:`C:\\Users\\danie\\AppData\\Roaming`,ChocolateyInstall:`C:\\ProgramData\\chocolatey`,ChocolateyLastPathUpdate:`133616408220066520`,CHROME_CRASHPAD_PIPE_NAME:`\\\\.\\pipe\\crashpad_11292_YRBGHFOOQWCPDPQR`,CommonProgramFiles:`C:\\Program Files\\Common Files`,"CommonProgramFiles(x86)":`C:\\Program Files (x86)\\Common Files`,CommonProgramW6432:`C:\\Program Files\\Common Files`,COMPUTERNAME:`DOE`,ComSpec:`C:\\WINDOWS\\system32\\cmd.exe`,CUDA_PATH:`C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.5`,CUDA_PATH_V11_5:`C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.5`,CURSOR_AGENT:`1`,CURSOR_AGENT_STORE_FILES_DIR:`C:\\Users\\danie\\AppData\\Local\\Cursor\\AgentStores\\cursor_agent_stores\\7cc06761-0387-403c-8a06-f433e844516a\\files`,CURSOR_AGENT_STORE_SHARED_PATHS:`{"user":{"path":"C:\\\\Users\\\\danie\\\\AppData\\\\Local\\\\Cursor\\\\AgentStores\\\\cursor_agent_stores\\\\u297751068\\\\files","readOnly":false}}`,CURSOR_CONVERSATION_ID:`7cc06761-0387-403c-8a06-f433e844516a`,CURSOR_EXTENSION_HOST_ROLE:`agent-exec`,CURSOR_LAYOUT:`unifiedAgent`,CURSOR_REQUEST_ID:`4e81db45-0ae2-40d7-bffc-37f028f3df3c`,CURSOR_RIPGREP_PATH:`c:\\Users\\danie\\AppData\\Local\\Programs\\cursor\\resources\\app\\node_modules\\@vscode\\ripgrep\\bin\\rg.exe`,CURSOR_WORKSPACE_LABEL:`coursecollab-desktop`,DriverData:`C:\\Windows\\System32\\Drivers\\DriverData`,EFC_12292_1592913036:`1`,EFC_12292_4126798990:`1`,FORCE_COLOR:`0`,HOME:`C:\\Users\\danie`,HOMEDRIVE:`C:`,HOMEPATH:`\\Users\\danie`,LOCALAPPDATA:`C:\\Users\\danie\\AppData\\Local`,LOGONSERVER:`\\\\DOE`,NODE_PATH:`C:\\Users\\danie\\Downloads\\coursecollab-desktop\\node_modules\\.pnpm\\vite@8.2.2_@types+node@22.20.1_jiti@2.7.0\\node_modules\\vite\\bin\\node_modules;C:\\Users\\danie\\Downloads\\coursecollab-desktop\\node_modules\\.pnpm\\vite@8.2.2_@types+node@22.20.1_jiti@2.7.0\\node_modules\\vite\\node_modules;C:\\Users\\danie\\Downloads\\coursecollab-desktop\\node_modules\\.pnpm\\vite@8.2.2_@types+node@22.20.1_jiti@2.7.0\\node_modules;C:\\Users\\danie\\Downloads\\coursecollab-desktop\\node_modules\\.pnpm\\node_modules`,NO_COLOR:`1`,npm_command:`exec`,npm_config_user_agent:`pnpm/9.9.0 npm/? node/v20.11.1 win32 x64`,NUMBER_OF_PROCESSORS:`16`,NVCUDASAMPLES11_5_ROOT:`C:\\ProgramData\\NVIDIA Corporation\\CUDA Samples\\v11.5`,NVCUDASAMPLES_ROOT:`C:\\ProgramData\\NVIDIA Corporation\\CUDA Samples\\v11.5`,NVM_HOME:`C:\\Users\\danie\\AppData\\Roaming\\nvm`,NVM_SYMLINK:`C:\\Program Files\\nodejs`,NVTOOLSEXT_PATH:`C:\\Program Files\\NVIDIA Corporation\\NvToolsExt\\`,OneDrive:`C:\\Users\\danie\\OneDrive`,OS:`Windows_NT`,Path:`./node_modules/.bin;c:\\Users\\danie\\AppData\\Local\\Programs\\cursor\\resources\\app\\node_modules\\@vscode\\ripgrep\\bin;C:\\Python314\\Scripts\\;C:\\Python314\\;C:\\Program Files (x86)\\VMware\\VMware Workstation\\bin\\;C:\\Python312\\Scripts\\;C:\\Python312\\;C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.5\\bin;C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.5\\libnvvp;C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\;C:\\Windows\\System32\\OpenSSH\\;C:\\Program Files\\NVIDIA Corporation\\Nsight Compute 2021.3.0\\;C:\\Program Files (x86)\\NVIDIA Corporation\\PhysX\\Common;C:\\Program Files\\dotnet\\;C:\\ProgramData\\chocolatey\\bin;C:\\Program Files\\Git\\cmd;%NVM_HOME%;%NVM_SYMLINK%;C:\\Program Files\\NVIDIA Corporation\\NVIDIA app\\NvDLISR;C:\\WINDOWS\\system32;C:\\WINDOWS;C:\\WINDOWS\\System32\\Wbem;C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\;C:\\WINDOWS\\System32\\OpenSSH\\;C:\\Program Files\\cursor\\resources\\app\\bin;C:\\Program Files\\nodejs\\;C:\\Program Files\\Docker\\Docker\\resources\\bin;C:\\Users\\danie\\AppData\\Local\\pnpm;C:\\texlive\\2024\\bin\\windows;C:\\Users\\danie\\anaconda3;C:\\Users\\danie\\anaconda3\\Library\\mingw-w64\\bin;C:\\Users\\danie\\anaconda3\\Library\\usr\\bin;C:\\Users\\danie\\anaconda3\\Library\\bin;C:\\Users\\danie\\anaconda3\\Scripts;C:\\Users\\danie\\AppData\\Local\\Programs\\Python\\Launcher\\;C:\\Users\\danie\\AppData\\Local\\Microsoft\\WindowsApps;C:\\Users\\danie\\AppData\\Local\\Programs\\Microsoft VS Code\\bin;C:\\Users\\danie\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\;C:\\Users\\danie\\AppData\\Local\\Pandoc\\;C:\\Users\\danie\\AppData\\Roaming\\nvm;C:\\Program Files\\nodejs;C:\\Users\\danie\\AppData\\Roaming\\npm;C:\\Users\\danie\\AppData\\Local\\Programs\\cursor\\resources\\app\\bin`,PATHEXT:`.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JSE;.WSF;.WSH;.MSC;.PY;.PYW;.CPL`,PNPM_HOME:`C:\\Users\\danie\\AppData\\Local\\pnpm`,PNPM_PACKAGE_NAME:`coursecollab-desktop`,PROCESSOR_ARCHITECTURE:`AMD64`,PROCESSOR_IDENTIFIER:`Intel64 Family 6 Model 167 Stepping 1, GenuineIntel`,PROCESSOR_LEVEL:`6`,PROCESSOR_REVISION:`a701`,ProgramData:`C:\\ProgramData`,ProgramFiles:`C:\\Program Files`,"ProgramFiles(x86)":`C:\\Program Files (x86)`,ProgramW6432:`C:\\Program Files`,PROMPT:`$P$G`,PSExecutionPolicyPreference:`Bypass`,PSModulePath:`C:\\Users\\danie\\Documents\\WindowsPowerShell\\Modules;C:\\Program Files\\WindowsPowerShell\\Modules;C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules`,PUBLIC:`C:\\Users\\Public`,RlsSvcPort:`22112`,SESSIONNAME:`Console`,SystemDrive:`C:`,SystemRoot:`C:\\WINDOWS`,TEMP:`C:\\Users\\danie\\AppData\\Local\\Temp`,TERM:`dumb`,TMP:`C:\\Users\\danie\\AppData\\Local\\Temp`,USERDOMAIN:`DOE`,USERDOMAIN_ROAMINGPROFILE:`DOE`,USERNAME:`danie`,USERPROFILE:`C:\\Users\\danie`,VSCODE_CODE_CACHE_PATH:`C:\\Users\\danie\\AppData\\Roaming\\Cursor\\CachedData\\dd066f332fcea7382764400fde902f61920648d0`,VSCODE_CRASH_REPORTER_PROCESS_TYPE:`extensionHost`,VSCODE_CWD:`C:\\Users\\danie\\AppData\\Local\\Programs\\cursor`,VSCODE_ESM_ENTRYPOINT:`vs/workbench/api/node/extensionHostProcess`,VSCODE_HANDLES_UNCAUGHT_ERRORS:`true`,VSCODE_IPC_HOOK:`\\\\.\\pipe\\8f52cb06-3.19.13-main-sock`,VSCODE_NLS_CONFIG:`{"userLocale":"en-us","osLocale":"en-us","resolvedLanguage":"en","defaultMessagesFile":"C:\\\\Users\\\\danie\\\\AppData\\\\Local\\\\Programs\\\\cursor\\\\resources\\\\app\\\\out\\\\nls.messages.json","locale":"en-us","availableLanguages":{}}`,VSCODE_PID:`11292`,VSCODE_PROCESS_TITLE:`extension-host (agent-exec) coursecollab-desktop [2-9]`,windir:`C:\\WINDOWS`,_ZO_DOCTOR:`0`,__CURSOR_SANDBOX_ENV_RESTORE:`builtin unset CURSOR_CONVERSATION_ID CURSOR_REQUEST_ID CURSOR_AGENT_STORE_FILES_DIR CURSOR_AGENT_STORE_SHARED_PATHS 2>/dev/null || true; builtin export CURSOR_CONVERSATION_ID='7cc06761-0387-403c-8a06-f433e844516a'; builtin export CURSOR_REQUEST_ID='4e81db45-0ae2-40d7-bffc-37f028f3df3c'; builtin export CURSOR_AGENT_STORE_FILES_DIR='C:\\Users\\danie\\AppData\\Local\\Cursor\\AgentStores\\cursor_agent_stores\\7cc06761-0387-403c-8a06-f433e844516a\\files'; builtin export CURSOR_AGENT_STORE_SHARED_PATHS='{"user":{"path":"C:\\\\Users\\\\danie\\\\AppData\\\\Local\\\\Cursor\\\\AgentStores\\\\cursor_agent_stores\\\\u297751068\\\\files","readOnly":false}}'`,__PSLockDownPolicy:`0`}.VERCEL_ENV||`production`}function s(e){let t=e.stackTrace?.split(`
`).find(e=>e.trim())?.trim()??``,n=[e.category,e.moduleName??``,e.apiEndpoint??``,(e.errorMessage??``).slice(0,300),t.slice(0,200)].join(`|`);return(0,r.createHash)(`sha256`).update(n).digest(`hex`).slice(0,32)}function c(e){let t=[],n=(e.errorMessage??``).toLowerCase(),r=(e.stackTrace??``).toLowerCase();return(e.httpStatusCode===401||n.includes(`unauthorized`))&&t.push(`Authentication token may be missing or expired`),(e.httpStatusCode===403||n.includes(`forbidden`)||n.includes(`permission`))&&t.push(`User may lack required role or course permission`),(e.httpStatusCode===404||n.includes(`not found`))&&t.push(`Referenced resource may have been deleted or ID is invalid`),(e.httpStatusCode===409||n.includes(`duplicate`)||n.includes(`unique constraint`))&&t.push(`Duplicate record or unique constraint violation`),e.httpStatusCode===429&&t.push(`Rate limit exceeded — consider throttling or retry backoff`),(n.includes(`timeout`)||n.includes(`statement_timeout`))&&t.push(`Database or API query exceeded timeout threshold`),n.includes(`connection`)&&(n.includes(`refused`)||n.includes(`terminated`))&&t.push(`Database connection failure — check DATABASE_URL and pool health`),n.includes(`foreign key`)&&t.push(`Foreign key constraint — parent record may be missing`),n.includes(`hydration`)&&t.push(`React hydration mismatch — server/client HTML differs`),(r.includes(`chunkloaderror`)||n.includes(`loading chunk`))&&t.push(`Stale deployment — user may need hard refresh after deploy`),e.category===`storage`&&t.push(`File storage provider or upload configuration issue`),e.category===`email`&&t.push(`SMTP or email delivery service configuration issue`),[...new Set([...e.rootCauseHints??[],...t])]}function l(e){return e.title?.trim()?e.title.trim():e.errorMessage?.trim()?e.errorMessage.trim().slice(0,200):`${e.category} ${e.severity}`.replace(/^\w/,e=>e.toUpperCase())}async function u(e,t,r){let i=await n`
    SELECT id, affected_user_count, status FROM system_log_groups WHERE fingerprint = ${e} LIMIT 1
  `;if(i.length===0)return null;let a=Number(i[0].id),o=Number(i[0].affected_user_count),s=0;if(r.userId){let[t]=await n`
      SELECT 1 FROM system_logs
      WHERE fingerprint = ${e} AND user_id = ${r.userId}
      LIMIT 1
    `;t||(s=1)}let c=String(i[0].status),l=r.onRecurrence===`reopen_resolved`&&c===`resolved`,u=r.onRecurrence===`needs_attention`&&(c===`resolved`||c===`open`);return await n`
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
  `,a}async function d(e,t,r,i){let a=i?.initialStatus??`open`,o=i?.onRecurrence??`reopen_resolved`,s=t.userId?.trim()||null,c=await u(e,t,{onRecurrence:o,userId:s});if(c!=null)return c;try{let[i]=await n`
      INSERT INTO system_log_groups (
        fingerprint, title, severity, category, module_name,
        occurrence_count, affected_user_count, first_seen_at, last_seen_at, status
      ) VALUES (
        ${e},
        ${r},
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
    `;return i?Number(i.id):null}catch(n){if((n&&typeof n==`object`&&`code`in n?String(n.code):void 0)===`23505`)return u(e,t,{onRecurrence:o,userId:s});throw n}}async function f(t){try{await a();let i=(0,r.randomUUID)(),u=l(t),f=e(t),p=t.groupFingerprint??s({category:t.category,moduleName:t.moduleName,apiEndpoint:t.apiEndpoint,errorMessage:t.errorMessage,stackTrace:t.stackTrace}),m=c(t),h=JSON.stringify(t.metadata??{}),g=JSON.stringify(m),_=t.environment??o(),v=t.alwaysGroup||t.severity===`error`||t.severity===`critical`||t.groupStatus===`needs_attention`?await d(p,t,u,{initialStatus:t.groupStatus??`open`,onRecurrence:t.groupOnRecurrence??`reopen_resolved`}):null;return await n`
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
        ${i},
        ${v},
        ${p},
        ${_},
        ${t.severity},
        ${t.category},
        ${u},
        ${f},
        ${t.errorMessage??null},
        ${t.stackTrace??null},
        ${t.moduleName??null},
        ${t.featureName??null},
        ${t.pageUrl??null},
        ${t.route??null},
        ${t.apiEndpoint??null},
        ${t.httpMethod??null},
        ${t.httpStatusCode??null},
        ${t.userId??null},
        ${t.userName??null},
        ${t.userRole??null},
        ${t.courseId??null},
        ${t.courseName??null},
        ${t.browser??null},
        ${t.operatingSystem??null},
        ${t.deviceType??null},
        ${t.screenResolution??null},
        ${t.ipAddress??null},
        ${t.sessionId??null},
        ${t.executionTimeMs??null},
        ${h}::jsonb,
        ${g}::jsonb,
        ${t.userAgent??null}
      )
      ON CONFLICT (log_id) DO NOTHING
    `,i}catch(e){return console.warn(`[system-log] insert failed`,e),null}}function p(e){if(e instanceof Error)return e.message;if(typeof e==`string`)return e;try{return JSON.stringify(e)}catch{return`Unknown error`}}function m(e){return e instanceof Error&&e.stack?e.stack:null}function h(e,t){let n=p(e),r=e&&typeof e==`object`&&`code`in e?String(e.code):void 0,i=String(t?.metadata?.queryPreview??``);return!!(r===`42703`&&n.includes(`deleted_at`)||r===`42703`&&n.includes(`created_at`)&&i.includes(`practice_attempts`)||r===`42703`&&n.includes(`lecture_workspace`)||r===`42703`&&n.includes(`completed`)&&i.includes(`playground_results`)||r===`22003`&&i.includes(`playground_results`)&&i.includes(`completed_at`)||r===`23505`&&n.includes(`system_log_groups_fingerprint_key`)||r===`42P01`&&i.includes(`attempt_creation_audit`)||i.includes(`update_student_learning_profile`)&&n.includes(`completed`)||i.includes(`generate_quiz_report`)&&(r===`57014`||n.toLowerCase().includes(`timeout`))||i.includes(`save_learning_report`)&&(r===`57014`||n.toLowerCase().includes(`timeout`))||r===`42P01`&&i.includes(`student_answer_backup`)||r===`42883`&&n.includes(`digest`)||r===`42703`&&i.includes(`quiz_attempts`)&&n.includes(`is_finalized`)||r===`42703`&&i.includes(`quizzes`)&&n.includes(`anti_cheat_config`)||r===`42P01`&&i.includes(`classroom_submissions`)||r===`42703`&&i.includes(`classroom_point_submissions`)&&n.includes(`active`)||r===`23503`&&n.includes(`student_learning_profile_student_id_fkey`)&&i.includes(`playground_results`)||r===`42P01`&&i.includes(`practice_hub_attempts`)||r===`42703`&&i.includes(`quizzes`)&&n.includes(`is_active`)||r===`42703`&&i.includes(`quiz_questions`)&&n.includes(`updated_at`)||r===`42702`&&i.includes(`attendance_streaks`)&&n.includes(`ambiguous`)||r===`42P01`&&i.includes(`platform_activity_log`)||r===`42703`&&i.includes(`password_reset_requests`)&&n.includes(`full_name`)||r===`42703`&&i.includes(`circuit_spec`)||r===`42703`&&i.includes(`pdf_blob_url`)||r===`42703`&&i.includes(`week_number`)&&i.includes(`lectures`)||r===`42703`&&i.includes(`activity_type`)&&i.includes(`student_activity_points`)||n.includes(`fetch failed`)&&i.includes(`system_log_groups`)||n.toLowerCase().includes(`timeout`)&&(i.includes(`system_log_groups`)||i.includes(`system_logs`)))}async function g(e,t){if(h(e,t))return;let n=p(e),r=m(e),i=e&&typeof e==`object`&&`code`in e?String(e.code):void 0;await f({severity:n.toLowerCase().includes(`timeout`)?`critical`:`error`,category:`database`,title:t?.operation?`Database error: ${t.operation}`:`Database error`,errorMessage:n,stackTrace:r,moduleName:t?.moduleName??`Platform Module`,featureName:t?.table??void 0,metadata:{operation:t?.operation,table:t?.table,errorCode:i,...t?.metadata??{}},rootCauseHints:i?[`PostgreSQL error code: ${i}`]:void 0})}export{g as logDatabaseError};