/**
 * سكريبت رفع وتحديث قاعدة البيانات على Supabase
 * تشغيل: node scripts/upload_to_supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ecgofdogiwnkokvpnxpl.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_IAk9fGbomVw8ZYa3paa6Vg_Aby9SBmc';

const dbPath = path.join(__dirname, '..', 'data', 'database.json');

async function uploadToSupabase() {
  console.log('📡 جاري الاتصال بمشروع Supabase...');
  console.log('🔗 الرابط:', SUPABASE_URL);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (!fs.existsSync(dbPath)) {
    console.error('❌ ملف قاعدة البيانات data/database.json غير موجود!');
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log(`📊 تم قراءة ملف database.json: يحتوي على ${localData.readers?.length || 0} قراء، و ${localData.tasks?.length || 0} مهام.`);

  try {
    // 1. فحص وجود جدول app_state ومحاولة الرفع
    console.log('⏳ جاري رفع الحالة المركزية إلى جدول app_state...');
    const { data: upsertData, error: upsertErr } = await supabase
      .from('app_state')
      .upsert({
        id: 'zad_main',
        data: localData,
        last_modified: new Date().toISOString(),
      })
      .select();

    if (upsertErr) {
      if (upsertErr.code === 'PGRST205' || upsertErr.message?.includes('schema cache')) {
        console.log('\n⚠️ تنبيه: الجداول لم تُنشأ بعد في قاعدة بيانات Supabase.');
        console.log('يرجى فتح لوحة تحكم Supabase واتباع الآتي:');
        console.log('1. اذهب إلى: https://supabase.com/dashboard/project/ecgofdogiwnkokvpnxpl/sql');
        console.log('2. افتح ملف "supabase_schema.sql" وانسخ كامل محتواه.');
        console.log('3. الصقه في محرر الـ SQL Editor واضغط زر Run الأخضر.');
        console.log('4. أعد تشغيل هذا الأمر: node scripts/upload_to_supabase.js\n');
        return;
      }
      throw upsertErr;
    }

    console.log('✅ تم رفع وتحديث جدول app_state بنجاح! 🟢');

    // 2. محاولة رفع جدول القراء إذا كان موجوداً
    if (localData.readers && localData.readers.length > 0) {
      const readersRows = localData.readers.map((r) => ({
        id: String(r.id),
        name: r.name,
        username: r.username,
        password: r.password || '123',
        role: r.role || 'user',
        current_juz: r.currentJuz || 1,
        is_first_login: Boolean(r.isFirstLogin),
      }));

      const { error: readersErr } = await supabase.from('readers').upsert(readersRows);
      if (!readersErr) {
        console.log(`✅ تم تحديث جدول readers بـ (${readersRows.length}) عضو.`);
      }
    }

    // 3. محاولة رفع جدول المهام إذا كان موجوداً
    if (localData.tasks && localData.tasks.length > 0) {
      const tasksRows = localData.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        icon: t.icon,
        target_count: t.targetCount,
        unit: t.unit,
        due_time: t.dueTime,
        description: t.description || '',
        is_active: t.isActive !== false,
      }));

      const { error: tasksErr } = await supabase.from('tasks').upsert(tasksRows);
      if (!tasksErr) {
        console.log(`✅ تم تحديث جدول tasks بـ (${tasksRows.length}) مهمة.`);
      }
    }

    console.log('\n🎉 تمت عملية المزامنة مع Supabase بنجاح تام!');
  } catch (err) {
    console.error('❌ حدث خطأ أثناء المزامنة مع Supabase:', err.message);
  }
}

uploadToSupabase();
