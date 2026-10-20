-- ==============================================================================
-- 🕋 قاعدة بيانات "زاد الأنصاري" - مشورة إب على Supabase (PostgreSQL)
-- هذا الملف يحتوي على جميع الجداول، الصلاحيات (RLS)، والتفعيل اللحظي (Realtime)
-- والبيانات الأولية الجاهزة للتنفيذ في Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. جدول الحالة المركزية المتزامنة لحظياً (Central Synchronized State)
CREATE TABLE IF NOT EXISTS public.app_state (
    id TEXT PRIMARY KEY DEFAULT 'zad_main',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول المحادثة الجماعية المشفرة (E2EE Messages)
CREATE TABLE IF NOT EXISTS public.group_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL DEFAULT 'user',
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    encrypted_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature TEXT DEFAULT '',
    is_encrypted BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جداول البيانات التفصيلية (للمعاينة والتعديل عبر واجهة Supabase Table Editor)

-- جدول القراء / الأعضاء
CREATE TABLE IF NOT EXISTS public.readers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL DEFAULT '123',
    role TEXT NOT NULL DEFAULT 'user',
    current_juz INTEGER NOT NULL DEFAULT 1,
    is_first_login BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول المشرفين والمدراء
CREATE TABLE IF NOT EXISTS public.admins (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL DEFAULT '123',
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    is_first_login BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول التكاليف والمهام اليومية
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'ADHKAR',
    icon TEXT DEFAULT '📖',
    target_count INTEGER NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'مرة',
    due_time TEXT DEFAULT '23:59',
    description TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول حالات قراءة الورد اليومي
CREATE TABLE IF NOT EXISTS public.daily_statuses (
    id BIGSERIAL PRIMARY KEY,
    date_key TEXT NOT NULL,
    reader_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    note TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date_key, reader_id)
);

-- جدول إنجاز التكاليف والأنشطة
CREATE TABLE IF NOT EXISTS public.task_submissions (
    id BIGSERIAL PRIMARY KEY,
    sub_key TEXT NOT NULL UNIQUE,
    date_key TEXT NOT NULL,
    task_id TEXT NOT NULL,
    reader_id TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول المحادثة الجماعية المشفرة (E2EE Messages)
CREATE TABLE IF NOT EXISTS public.group_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL DEFAULT 'user',
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    encrypted_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature TEXT DEFAULT '',
    is_encrypted BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول الإعلانات والتعميمات
CREATE TABLE IF NOT EXISTS public.announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول الاستبيانات والتصويت
CREATE TABLE IF NOT EXISTS public.surveys (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    votes JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول الإعدادات العامة
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    juz_count INTEGER DEFAULT 1,
    reminder_enabled BOOLEAN DEFAULT false,
    reminder_hour INTEGER DEFAULT 20,
    reminder_minute INTEGER DEFAULT 0,
    motivational_message TEXT DEFAULT 'هنيئاً لك يا قارئ القرآن، أنت من أهل الله وخاصته',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول المحادثة الجماعية المشفرة (E2EE Messages)
CREATE TABLE IF NOT EXISTS public.group_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL DEFAULT 'user',
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    encrypted_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature TEXT DEFAULT '',
    is_encrypted BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 🔒 تفعيل الأمان والصلاحيات (Row Level Security - RLS)
-- السماح لتطبيق الجوال والمتصفح بالقراءة والكتابة المباشرة عبر المفتاح العام (Anon)
-- ==============================================================================

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول العام (Public Policies)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public all on app_state" ON public.app_state;
    CREATE POLICY "Allow public all on app_state" ON public.app_state FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all on readers" ON public.readers;
    CREATE POLICY "Allow public all on readers" ON public.readers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all on admins" ON public.admins;
    CREATE POLICY "Allow public all on admins" ON public.admins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all on tasks" ON public.tasks;
    CREATE POLICY "Allow public all on tasks" ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all on daily_statuses" ON public.daily_statuses;
    CREATE POLICY "Allow public all on daily_statuses" ON public.daily_statuses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all on task_submissions" ON public.task_submissions;
    CREATE POLICY "Allow public all on task_submissions" ON public.task_submissions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all on announcements" ON public.announcements;
    CREATE POLICY "Allow public all on announcements" ON public.announcements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all on surveys" ON public.surveys;
    CREATE POLICY "Allow public all on surveys" ON public.surveys FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all on settings" ON public.settings;
    CREATE POLICY "Allow public all on settings" ON public.settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- ⚡ تفعيل البث اللحظي (Realtime) لتحديث شاشات جميع المستخدمين فوراً
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'app_state'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_state;
    END IF;
END $$;

-- ==============================================================================
-- 📥 زرع البيانات الأولية الكاملة (Initial Data Seeding)
-- ==============================================================================

-- 1. زرع جدول القراء (الأعضاء الستة الأوائل)
INSERT INTO public.readers (id, name, username, password, role, current_juz, is_first_login) VALUES
('1', 'مراد', 'مراد', '123', 'user', 1, false),
('2', 'علي', 'علي', '123', 'user', 2, false),
('3', 'العرندس', 'العرندس', '123', 'user', 3, false),
('4', 'وائل', 'وائل', '123', 'user', 4, false),
('5', 'مختار', 'مختار', '123', 'user', 5, false),
('6', 'ابو طالوت', 'ابو_طالوت', '123', 'user', 6, false)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    username = EXCLUDED.username,
    current_juz = EXCLUDED.current_juz;

-- 2. زرع حساب المدير العام
INSERT INTO public.admins (id, username, password, name, role, is_first_login) VALUES
('admin_root', 'admin', '123', 'المدير العام', 'admin', false)
ON CONFLICT (id) DO NOTHING;

-- 3. زرع التكاليف والأذكار اليومية
INSERT INTO public.tasks (id, title, category, icon, target_count, unit, due_time, description, is_active) VALUES
('task_quran', 'الورد القرآني اليومي', 'QURAN', '📖', 1, 'أجزاء', '23:59', 'قراءة الجزء المقرر اليومي من كتاب الله تعالى', true),
('task_adhkar_morning', 'أذكار الصباح والمساء', 'ADHKAR', '🌅', 1, 'مرة', '23:59', 'قراءة وملازمة أذكار الصباح وأذكار المساء لحفظ العبد', true),
('task_tasbeeh', 'الاستغفار والتسبيح', 'ADHKAR', '📿', 100, 'مرة', '23:59', 'مائة مرة استغفار وتسبيح يومياً', true),
('task_salawat', 'الصلاة على النبي ﷺ', 'ADHKAR', '🕌', 100, 'مرة', '23:59', 'مائة صلاة على الحبيب المصطفى ﷺ', true)
ON CONFLICT (id) DO NOTHING;

-- 4. زرع الإعدادات الافتراضية
INSERT INTO public.settings (id, juz_count, reminder_enabled, reminder_hour, reminder_minute, motivational_message) VALUES
('main', 1, false, 20, 0, 'هنيئاً لك يا قارئ القرآن، أنت من أهل الله وخاصته')
ON CONFLICT (id) DO NOTHING;

-- 5. زرع الحالة المجمعة الكاملة في جدول app_state
INSERT INTO public.app_state (id, data, last_modified) VALUES
(
    'zad_main',
    '{
        "version": 1,
        "lastModified": "2026-10-19T08:13:33.214Z",
        "admins": [
            {
                "id": "admin_root",
                "username": "admin",
                "password": "123",
                "name": "المدير العام",
                "role": "admin",
                "isFirstLogin": false
            }
        ],
        "readers": [
            { "id": "1", "name": "مراد", "username": "مراد", "password": "123", "role": "user", "currentJuz": 1, "isFirstLogin": false },
            { "id": "2", "name": "علي", "username": "علي", "password": "123", "role": "user", "currentJuz": 2, "isFirstLogin": false },
            { "id": "3", "name": "العرندس", "username": "العرندس", "password": "123", "role": "user", "currentJuz": 3, "isFirstLogin": false },
            { "id": "4", "name": "وائل", "username": "وائل", "password": "123", "role": "user", "currentJuz": 4, "isFirstLogin": false },
            { "id": "5", "name": "مختار", "username": "مختار", "password": "123", "role": "user", "currentJuz": 5, "isFirstLogin": false },
            { "id": "6", "name": "ابو طالوت", "username": "ابو_طالوت", "password": "123", "role": "user", "currentJuz": 6, "isFirstLogin": false }
        ],
        "settings": {
            "juzCount": 1,
            "reminderEnabled": false,
            "reminderHour": 20,
            "reminderMinute": 0
        },
        "dailyStatuses": {},
        "tasks": [
            {
                "id": "task_quran",
                "title": "الورد القرآني اليومي",
                "category": "QURAN",
                "icon": "📖",
                "targetCount": 1,
                "unit": "أجزاء",
                "dueTime": "23:59",
                "description": "قراءة الجزء المقرر اليومي من كتاب الله تعالى",
                "isActive": true
            },
            {
                "id": "task_adhkar_morning",
                "title": "أذكار الصباح والمساء",
                "category": "ADHKAR",
                "icon": "🌅",
                "targetCount": 1,
                "unit": "مرة",
                "dueTime": "23:59",
                "description": "قراءة وملازمة أذكار الصباح وأذكار المساء لحفظ العبد",
                "isActive": true
            },
            {
                "id": "task_tasbeeh",
                "title": "الاستغفار والتسبيح",
                "category": "ADHKAR",
                "icon": "📿",
                "targetCount": 100,
                "unit": "مرة",
                "dueTime": "23:59",
                "description": "مائة مرة استغفار وتسبيح يومياً",
                "isActive": true
            },
            {
                "id": "task_salawat",
                "title": "الصلاة على النبي ﷺ",
                "category": "ADHKAR",
                "icon": "🕌",
                "targetCount": 100,
                "unit": "مرة",
                "dueTime": "23:59",
                "description": "مائة صلاة على الحبيب المصطفى ﷺ",
                "isActive": true
            }
        ],
        "taskSubmissions": {},
        "surveys": [],
        "announcements": [],
        "motivationalMessage": "هنيئاً لك يا قارئ القرآن، أنت من أهل الله وخاصته"
    }'::jsonb,
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    last_modified = NOW(),
    updated_at = NOW();

-- ==============================================================================
-- 🚀 إجراء ذري لتطبيق حركات المزامنة (Atomic Sync RPC Function)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.apply_sync_actions(p_actions JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_state JSONB;
    v_action JSONB;
    v_type TEXT;
    v_payload JSONB;
    v_date_key TEXT;
    v_reader_id TEXT;
    v_sub_key TEXT;
    v_task_id TEXT;
    v_survey_id TEXT;
    v_now TEXT;
BEGIN
    -- قفل السطر للتزامن الذري ومنع تضارب التعديلات
    SELECT data INTO v_state
    FROM public.app_state
    WHERE id = 'zad_main'
    FOR UPDATE;

    IF v_state IS NULL THEN
        RAISE EXCEPTION 'لم يتم العثور على حالة التطبيق';
    END IF;

    v_now := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

    FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions)
    LOOP
        v_type := v_action->>'type';
        v_payload := v_action->'payload';

        CASE v_type
            WHEN 'UPDATE_WIRD_STATUS' THEN
                v_date_key := v_payload->>'dateKey';
                v_reader_id := v_payload->>'readerId';
                IF v_date_key IS NOT NULL AND v_reader_id IS NOT NULL THEN
                    IF (v_state->'dailyStatuses'->v_date_key) IS NULL THEN
                        v_state := jsonb_set(v_state, ARRAY['dailyStatuses', v_date_key], '{}'::jsonb, true);
                    END IF;
                    v_state := jsonb_set(
                        v_state,
                        ARRAY['dailyStatuses', v_date_key, v_reader_id],
                        jsonb_build_object(
                            'status', COALESCE(v_payload->>'status', 'pending'),
                            'timestamp', COALESCE(v_payload->>'timestamp', v_now),
                            'note', COALESCE(v_payload->>'note', '')
                        ),
                        true
                    );
                END IF;

            WHEN 'SUBMIT_TASK' THEN
                v_date_key := v_payload->>'dateKey';
                v_task_id := v_payload->>'taskId';
                v_reader_id := v_payload->>'readerId';
                v_sub_key := v_date_key || '_' || v_task_id || '_' || v_reader_id;
                v_state := jsonb_set(
                    v_state,
                    ARRAY['taskSubmissions', v_sub_key],
                    jsonb_build_object(
                        'status', v_payload->>'status',
                        'reason', COALESCE(v_payload->>'reason', ''),
                        'timestamp', COALESCE(v_payload->>'timestamp', v_now)
                    ),
                    true
                );

            WHEN 'ADVANCE_WIRD', 'SAVE_READERS' THEN
                IF (v_payload->'readers') IS NOT NULL THEN
                    v_state := jsonb_set(v_state, '{readers}', v_payload->'readers', true);
                END IF;

            WHEN 'SAVE_SETTINGS' THEN
                v_state := jsonb_set(v_state, '{settings}', (v_state->'settings') || v_payload, true);

            WHEN 'CREATE_TASK' THEN
                IF (v_payload->'task') IS NOT NULL THEN
                    v_state := jsonb_set(v_state, '{tasks}', (v_state->'tasks') || jsonb_build_array(v_payload->'task'), true);
                END IF;

            WHEN 'DELETE_TASK' THEN
                v_task_id := v_payload->>'taskId';
                v_state := jsonb_set(
                    v_state,
                    '{tasks}',
                    COALESCE(
                        (SELECT jsonb_agg(elem) FROM jsonb_array_elements(v_state->'tasks') elem WHERE elem->>'id' <> v_task_id),
                        '[]'::jsonb
                    ),
                    true
                );

            WHEN 'ADD_ANNOUNCEMENT' THEN
                IF (v_payload->'announcement') IS NOT NULL THEN
                    v_state := jsonb_set(v_state, '{announcements}', jsonb_build_array(v_payload->'announcement') || (v_state->'announcements'), true);
                END IF;

            WHEN 'SAVE_MOTIVATIONAL_MSG' THEN
                IF (v_payload->>'message') IS NOT NULL THEN
                    v_state := jsonb_set(v_state, '{motivationalMessage}', to_jsonb(v_payload->>'message'), true);
                END IF;

            WHEN 'SEND_GROUP_MESSAGE' THEN
                IF (v_payload->'message') IS NOT NULL THEN
                    IF (v_state->'groupMessages') IS NULL THEN
                        v_state := jsonb_set(v_state, '{groupMessages}', '[]'::jsonb, true);
                    END IF;
                    v_state := jsonb_set(v_state, '{groupMessages}', (v_state->'groupMessages') || jsonb_build_array(v_payload->'message'), true);
                END IF;

            WHEN 'REGISTER_CHAT_PUBLIC_KEY' THEN
                IF (v_payload->>'userId') IS NOT NULL AND (v_payload->>'publicKey') IS NOT NULL THEN
                    IF (v_state->'chatPublicKeys') IS NULL THEN
                        v_state := jsonb_set(v_state, '{chatPublicKeys}', '{}'::jsonb, true);
                    END IF;
                    v_state := jsonb_set(v_state, ARRAY['chatPublicKeys', v_payload->>'userId'], to_jsonb(v_payload->>'publicKey'), true);
                END IF;

            ELSE
                NULL;
        END CASE;
    END LOOP;

    v_state := jsonb_set(v_state, '{lastModified}', to_jsonb(v_now), true);

    UPDATE public.app_state
    SET data = v_state,
        last_modified = NOW(),
        updated_at = NOW()
    WHERE id = 'zad_main';

    RETURN jsonb_build_object('success', true, 'lastModified', v_now, 'state', v_state);
END;
$$;
