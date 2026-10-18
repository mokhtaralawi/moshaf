#!/usr/bin/env bash

# ==============================================================
# سكربت النشر والتحديث التلقائي لتطبيق "زاد الأنصاري" على سيرفر لينكس
# Zad Al-Ansari Deployment Script for Linux
# ==============================================================

set -e

echo -e "\e[32m====================================================\e[0m"
echo -e "\e[32m 🚀 بدء عملية نشر وتحديث تطبيق: زاد الأنصاري (مشورة إب)\e[0m"
echo -e "\e[32m====================================================\e[0m"

# 1. التحقق من وجود Node.js
if ! command -v node &> /dev/null; then
    echo -e "\e[31m❌ خطأ: Node.js غير مثبت على السيرفر!\e[0m"
    echo "يرجى تثبيت Node.js (إصدار 20 أو أحدث) قبل المتابعة."
    exit 1
fi

echo -e "\e[34mℹ️  إصدار Node.js الحالي: $(node -v)\e[0m"
echo -e "\e[34mℹ️  إصدار npm الحالي: $(npm -v)\e[0m"

# 2. تثبيت الحزم والمكتبات
echo -e "\e[33m📦 تثبيت وتحديث حزم المشروع (npm install)...\e[0m"
npm install --legacy-peer-deps

# 3. بناء نسخة الويب للإنتاج
echo -e "\e[33m🏗️  بناء نسخة الويب المحسنة (npm run build:web)...\e[0m"
npm run build:web

# 4. إدارة السيرفر باستخدام PM2 إذا كان مثبتاً
if command -v pm2 &> /dev/null; then
    echo -e "\e[33m🔄 إعادة تشغيل التطبيق عبر PM2...\e[0m"
    if pm2 describe zad-alansari-app > /dev/null 2>&1; then
        pm2 reload ecosystem.config.js --env production
    else
        pm2 start ecosystem.config.js --env production
        pm2 save
    fi
    echo -e "\e[32m✅ تم تحديث التطبيق عبر PM2 بنجاح!\e[0m"
else
    echo -e "\e[33m⚠️  PM2 غير مثبت عالمياً. يمكنك تشغيل السيرفر يدوياً بالأمر:\e[0m"
    echo "  npm run start:prod"
fi

# 5. فحص الحالة
echo -e "\e[32m====================================================\e[0m"
echo -e "\e[32m 🎉 تمت عملية النشر بنجاح على سيرفر لينكس!\e[0m"
echo -e "\e[32m====================================================\e[0m"
