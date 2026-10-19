/**
 * خادم إدارة قاعدة البيانات السحابية المركزية لـ "زاد الأنصاري"
 * يضمن حفظ البيانات بشكل دائم وتزامنها بين جميع الأجهزة بدون فقدان
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// البيانات الافتراضية الأولية للنظام
const DEFAULT_STATE = {
  version: 1,
  lastModified: new Date().toISOString(),
  admins: [
    {
      id: 'admin_root',
      username: 'admin',
      password: '123',
      name: 'المدير العام',
      role: 'admin',
      isFirstLogin: false,
    },
  ],
  readers: [
    { id: '1', name: 'مراد', username: 'مراد', password: '123', role: 'user', currentJuz: 1, isFirstLogin: false },
    { id: '2', name: 'علي', username: 'علي', password: '123', role: 'user', currentJuz: 2, isFirstLogin: false },
    { id: '3', name: 'العرندس', username: 'العرندس', password: '123', role: 'user', currentJuz: 3, isFirstLogin: false },
    { id: '4', name: 'وائل', username: 'وائل', password: '123', role: 'user', currentJuz: 4, isFirstLogin: false },
    { id: '5', name: 'مختار', username: 'مختار', password: '123', role: 'user', currentJuz: 5, isFirstLogin: false },
    { id: '6', name: 'ابو طالوت', username: 'ابو_طالوت', password: '123', role: 'user', currentJuz: 6, isFirstLogin: false },
  ],
  settings: {
    juzCount: 1,
    reminderEnabled: false,
    reminderHour: 20,
    reminderMinute: 0,
  },
  dailyStatuses: {},
  tasks: [
    {
      id: 'task_quran',
      title: 'الورد القرآني اليومي',
      category: 'QURAN',
      icon: '📖',
      targetCount: 1,
      unit: 'أجزاء',
      dueTime: '23:59',
      description: 'قراءة الجزء المقرر اليومي من كتاب الله تعالى',
      isActive: true,
    },
    {
      id: 'task_adhkar_morning',
      title: 'أذكار الصباح والمساء',
      category: 'ADHKAR',
      icon: '🌅',
      targetCount: 1,
      unit: 'مرة',
      dueTime: '23:59',
      description: 'قراءة وملازمة أذكار الصباح وأذكار المساء لحفظ العبد',
      isActive: true,
    },
    {
      id: 'task_tasbeeh',
      title: 'الاستغفار والتسبيح',
      category: 'ADHKAR',
      icon: '📿',
      targetCount: 100,
      unit: 'مرة',
      dueTime: '23:59',
      description: 'مائة مرة استغفار وتسبيح يومياً',
      isActive: true,
    },
    {
      id: 'task_salawat',
      title: 'الصلاة على النبي ﷺ',
      category: 'ADHKAR',
      icon: '🕌',
      targetCount: 100,
      unit: 'مرة',
      dueTime: '23:59',
      description: 'مائة صلاة على الحبيب المصطفى ﷺ',
      isActive: true,
    },
  ],
  taskSubmissions: {},
  surveys: [],
  announcements: [],
  motivationalMessage: 'هنيئاً لك يا قارئ القرآن، أنت من أهل الله وخاصته',
};

class CloudDatabase {
  constructor() {
    this.state = null;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.state = JSON.parse(raw);
        // التأكد من اكتمال الحقول الأساسية
        this.state = { ...DEFAULT_STATE, ...this.state };
      } else {
        this.state = { ...DEFAULT_STATE };
        this.persist();
      }
    } catch (e) {
      console.error('فشل تحميل قاعدة البيانات، استخدام الحالة الافتراضية:', e);
      this.state = { ...DEFAULT_STATE };
    }
  }

  persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      this.state.lastModified = new Date().toISOString();
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (e) {
      console.error('خطأ أثناء حفظ قاعدة البيانات إلى القرص:', e);
    }
  }

  getState() {
    return this.state;
  }

  /**
   * تطبيق دفعة من عمليات المزامنة (Action Queue) القادمة من الأجهزة
   */
  applyActions(actions = []) {
    let modified = false;

    for (const action of actions) {
      const { type, payload } = action;
      if (!type || !payload) continue;

      switch (type) {
        case 'UPDATE_WIRD_STATUS': {
          const { dateKey, readerId, status, timestamp, note } = payload;
          if (dateKey && readerId) {
            if (!this.state.dailyStatuses[dateKey]) {
              this.state.dailyStatuses[dateKey] = {};
            }
            this.state.dailyStatuses[dateKey][readerId] = {
              status: status || 'pending',
              timestamp: timestamp || new Date().toISOString(),
              note: note || '',
            };
            modified = true;
          }
          break;
        }

        case 'SUBMIT_TASK': {
          const { dateKey, taskId, readerId, status, reason, timestamp } = payload;
          const subKey = `${dateKey}_${taskId}_${readerId}`;
          this.state.taskSubmissions[subKey] = {
            status,
            reason: reason || '',
            timestamp: timestamp || new Date().toISOString(),
          };
          modified = true;
          break;
        }

        case 'ADVANCE_WIRD': {
          const { readers } = payload;
          if (Array.isArray(readers)) {
            this.state.readers = readers;
            modified = true;
          }
          break;
        }

        case 'SAVE_READERS': {
          if (Array.isArray(payload.readers)) {
            this.state.readers = payload.readers;
            modified = true;
          }
          break;
        }

        case 'SAVE_SETTINGS': {
          this.state.settings = { ...this.state.settings, ...payload };
          modified = true;
          break;
        }

        case 'CREATE_TASK': {
          if (payload.task) {
            const exists = this.state.tasks.some((t) => t.id === payload.task.id);
            if (!exists) {
              this.state.tasks.push(payload.task);
              modified = true;
            }
          }
          break;
        }

        case 'DELETE_TASK': {
          if (payload.taskId) {
            this.state.tasks = this.state.tasks.filter((t) => t.id !== payload.taskId);
            modified = true;
          }
          break;
        }

        case 'CREATE_SURVEY': {
          if (payload.survey) {
            this.state.surveys.unshift(payload.survey);
            modified = true;
          }
          break;
        }

        case 'VOTE_SURVEY': {
          const { surveyId, userId, vote } = payload;
          const survey = this.state.surveys.find((s) => s.id === surveyId);
          if (survey) {
            if (!survey.votes) survey.votes = {};
            survey.votes[userId] = vote;
            modified = true;
          }
          break;
        }

        case 'CLOSE_SURVEY': {
          const survey = this.state.surveys.find((s) => s.id === payload.surveyId);
          if (survey) {
            survey.active = false;
            modified = true;
          }
          break;
        }

        case 'ADD_ANNOUNCEMENT': {
          if (payload.announcement) {
            this.state.announcements.unshift(payload.announcement);
            modified = true;
          }
          break;
        }

        case 'SAVE_MOTIVATIONAL_MSG': {
          if (payload.message) {
            this.state.motivationalMessage = payload.message;
            modified = true;
          }
          break;
        }

        case 'CHANGE_PASSWORD': {
          const { userId, role, newPassword } = payload;
          if (role === 'admin') {
            const admin = this.state.admins.find((a) => a.id === userId || a.username === userId);
            if (admin) {
              admin.password = newPassword;
              modified = true;
            }
          } else {
            const reader = this.state.readers.find((r) => r.id === userId || r.username === userId);
            if (reader) {
              reader.password = newPassword;
              reader.isFirstLogin = false;
              modified = true;
            }
          }
          break;
        }

        default:
          break;
      }
    }

    if (modified) {
      this.persist();
    }

    return {
      success: true,
      modified,
      lastModified: this.state.lastModified,
      state: this.state,
    };
  }

  /**
   * دمج حالة كاملة قادمة من تطبيق المدير
   */
  mergeState(partialState = {}) {
    if (partialState.readers && Array.isArray(partialState.readers)) {
      this.state.readers = partialState.readers;
    }
    if (partialState.settings) {
      this.state.settings = { ...this.state.settings, ...partialState.settings };
    }
    if (partialState.dailyStatuses) {
      this.state.dailyStatuses = { ...this.state.dailyStatuses, ...partialState.dailyStatuses };
    }
    if (partialState.tasks && Array.isArray(partialState.tasks)) {
      this.state.tasks = partialState.tasks;
    }
    if (partialState.taskSubmissions) {
      this.state.taskSubmissions = { ...this.state.taskSubmissions, ...partialState.taskSubmissions };
    }
    if (partialState.surveys && Array.isArray(partialState.surveys)) {
      this.state.surveys = partialState.surveys;
    }
    if (partialState.announcements && Array.isArray(partialState.announcements)) {
      this.state.announcements = partialState.announcements;
    }
    if (partialState.motivationalMessage) {
      this.state.motivationalMessage = partialState.motivationalMessage;
    }
    if (partialState.admins && Array.isArray(partialState.admins)) {
      this.state.admins = partialState.admins;
    }

    this.persist();
    return this.state;
  }
}

module.exports = new CloudDatabase();
