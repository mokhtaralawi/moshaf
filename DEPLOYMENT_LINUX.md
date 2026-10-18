# دليل نشر ورفع تطبيق « زاد الأنصاري - مشورة إب » على استضافة وسيرفرات لينكس (Linux)

تم تجهيز هذا الدليل الشامل ليغطي جميع سيناريوهات النشر على أنظمة لينكس المختلفة (Ubuntu, Debian, CentOS, AlmaLinux, RHEL, أو أي سيرفر سحابي مثل DigitalOcean, Hetzner, AWS, Linode, Contabo) بالإضافة إلى دعم Docker و cPanel.

---

## 📋 محتويات الدليل
1. [المتطلبات الأساسية للسيرفر](#1-المتطلبات-الأساسية-للسيرفر)
2. [الطريقة الأولى: النشر الاحترافي عبر (Node.js + PM2 + NGINX) - مستحسنة](#2-الطريقة-الأولى-النشر-الاحترافي-عبر-nodejs--pm2--nginx)
3. [الطريقة الثانية: النشر السريع عبر حاويات Docker & Docker Compose](#3-الطريقة-الثانية-النشر-السريع-عبر-حاويات-docker)
4. [الطريقة الثالثة: الرفع المباشر للملفات الثابتة على استضافات cPanel / Apache](#4-الطريقة-الثالثة-الرفع-المباشر-على-cpanel--apache)
5. [تأمين السيرفر وتثبيت شهادة SSL مجانية (Let's Encrypt)](#5-تأمين-السيرفر-وتثبيت-شهادة-ssl)
6. [كيفية تحديث التطبيق مستقبلاً بسلاسة (CI/CD البسيط)](#6-تحديث-التطبيق-مستقبلاً)
7. [فحص الأخطاء واستكشاف الأعطال (Troubleshooting)](#7-فحص-الأخطاء-واستكشاف-الأعطال)

---

## 1. المتطلبات الأساسية للسيرفر

- **نظام التشغيل:** Ubuntu 22.04 LTS أو 24.04 LTS (أو أي توزيعة Debian/Linux حديثة).
- **المواصفات الدنيا:**
  - الذاكرة العشوائية (RAM): 1 جيجابايت كحد أدنى (يفضل تفعيل Swap بمساحة 1 جيجا أثناء البناء).
  - المعالج (CPU): نواة واحدة (1 Core).
  - مساحة التخزين: 10 جيجابايت SSD.
- **البرمجيات المطلوبة على السيرفر:**
  - `Node.js` إصدار 20.x أو 22.x LTS.
  - `npm` أو `bun`.
  - خادم ويب `NGINX`.
  - مدير العمليات `PM2`.

---

## 2. الطريقة الأولى: النشر الاحترافي عبر (Node.js + PM2 + NGINX)

### الخطوة 1: الاتصال بالسيرفر وتحديث الحزم
اتصل بسيرفرك عبر الـ SSH:
```bash
ssh root@your-server-ip
```
ثم قم بتحديث حزم النظام وتثبيت المتطلبات الأساسية:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx build-essential
```

---

### الخطوة 2: تثبيت Node.js (v20 LTS) و PM2
قم بتثبيت Node.js من مستودع NodeSource الرسمي:
```bash
# إضافة مستودع Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# تثبيت Node.js
sudo apt install -y nodejs

# التأكد من التثبيت
node -v # يجب أن يظهر v20.x أو أعلى
npm -v

# تثبيت مدير العمليات PM2 عالمياً
sudo npm install -g pm2
```

---

### الخطوة 3: رفع أو سحب المشروع إلى السيرفر
يمكنك وضع المشروع في المسار القياسي `/var/www/zad-alansari`:

```bash
# إنشاء المجلد والانتقال إليه
sudo mkdir -p /var/www/zad-alansari
sudo chown -R $USER:$USER /var/www/zad-alansari
cd /var/www/zad-alansari

# الخيار أ: إذا كان المشروع على GitHub / GitLab:
git clone <رابط_المستودع> .

# الخيار ب: إذا قمت بنقله مضغوطاً عبر SCP أو FileZilla:
# فك الضغط في هذا المجلد
```

---

### الخطوة 4: تثبيت الحزم وبناء نسخة الويب للإنتاج
```bash
cd /var/www/zad-alansari

# تثبيت الحزم
npm install --legacy-peer-deps

# توليد ملفات الإنتاج المحسنة (Static Web Export)
npm run build:web
```
> **ملاحظة:** ستظهر رسالة تفيد بتصدير الملفات بنجاح إلى مجلد `dist/`.

---

### الخطوة 5: تشغيل التطبيق وإدارته عبر PM2
يحتوي المشروع على ملف إعدادات جاهز `ecosystem.config.js`. شغّل التطبيق بالأمر:
```bash
# تشغيل التطبيق
pm2 start ecosystem.config.js --env production

# حفظ قائمة العمليات لتعمل تلقائياً عند إعادة تشغيل السيرفر
pm2 save

# توليد أمر التشغيل التلقائي مع إقلاع النظام
pm2 startup
# (قم بنسخ السطر الذي سيظهره لك PM2 وتنفيذه إذا طلب ذلك)
```

للتحقق من أن السيرفر يعمل:
```bash
pm2 status
curl http://localhost:3000/health
```

---

### الخطوة 6: ضبط خادم NGINX كخادم وسيط عكسي (Reverse Proxy)
1. انسخ ملف الإعدادات المجهز في المشروع إلى مسارات Nginx:
```bash
sudo cp /var/www/zad-alansari/nginx.conf /etc/nginx/sites-available/zad-alansari
```

2. افتح الملف لتعديل اسم النطاق (Domain Name):
```bash
sudo nano /etc/nginx/sites-available/zad-alansari
```
> استبدل `your-domain.com` باسم موقعك الفعلي (أو بـ IP السيرفر إن لم يكن لديك نطاق بعد).

3. تفعيل الموقع وإعادة تشغيل NGINX:
```bash
# إنشاء الرابط الرمزي (Symlink)
sudo ln -s /etc/nginx/sites-available/zad-alansari /etc/nginx/sites-enabled/

# حذف الموقع الافتراضي لـ Nginx إن وجد
sudo rm -f /etc/nginx/sites-enabled/default

# فحص صحة إعدادات NGINX
sudo nginx -t

# إعادة تحميل NGINX
sudo systemctl reload nginx
```

---

## 3. الطريقة الثانية: النشر السريع عبر حاويات Docker

إذا كان خادمك يحتوي على Docker و Docker Compose، يمكنك تشغيل التطبيق بالكامل بأمر واحد دون الحاجة لتثبيت Node.js على السيرفر:

1. تثبيت Docker على السيرفر (إذا لم يكن مثبتاً):
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

2. تشغيل الحاوية:
```bash
cd /var/www/zad-alansari

# بناء وتشغيل الحاوية في الخلفية
docker compose up -d --build
```

3. لمتابعة السجلات وفحص الحالة:
```bash
docker compose logs -f
```

---

## 4. الطريقة الثالثة: الرفع المباشر على cPanel / Apache

إذا كانت استضافتك من نوع استضافة مشتركة (cPanel / DirectAdmin / Apache):

1. قم بتنفيذ أمر البناء محلياً على جهازك:
   ```bash
   npm run build:web
   ```
2. ادخل إلى مجلد `dist/`.
3. اضغط جميع محتويات مجلد `dist/` داخل ملف `zip` (تأكد من تضمين ملف `.htaccess`).
4. توجه إلى لوحة تحكم cPanel -> مدير الملفات (File Manager) -> مجلد `public_html`.
5. ارفع الملف المضغوط وفك الضغط داخله مباشرة.
6. التطبيق سيعمل فوراً مع كامل ميزات العمل بدون إنترنت (Offline-Ready) بفضل ملف `.htaccess` المرفق لدعم الـ SPA Routing.

---

## 5. تأمين السيرفر وتثبيت شهادة SSL

### تثبيت شهادة HTTPS مجانية عبر Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx

# إصدار وتفعيل الشهادة تلقائياً مع Nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### ضبط جدار الحماية (UFW Firewall):
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 6. تحديث التطبيق مستقبلاً

عند قيامك بأي تعديلات وتريد تطبيقها على السيرفر، يمكنك استخدام سكربت الأتمتة المرفق `deploy.sh`:

```bash
cd /var/www/zad-alansari

# سحب آخر التعديلات
git pull origin main

# تشغيل سكربت النشر التلقائي
bash deploy.sh
```

أو يدوياً:
```bash
npm install --legacy-peer-deps
npm run build:web
pm2 reload zad-alansari-app
```

---

## 7. فحص الأخطاء واستكشاف الأعطال

- **عرض سجلات تطبيق PM2 في الوقت الفعلي:**
  ```bash
  pm2 logs zad-alansari-app
  ```
- **عرض سجلات أخطاء NGINX:**
  ```bash
  sudo tail -f /var/log/nginx/error.log
  ```
- **إعادة تشغيل التطبيق:**
  ```bash
  pm2 restart zad-alansari-app
  ```
- **فحص استخدام الذاكرة والموارد:**
  ```bash
  pm2 monit
  ```

---
✨ **زاد الأنصاري - مشورة إب** جاهز الآن للعمل بكفاءة وسرعة فائقة على بيئة الإنتاج في لينكس!
