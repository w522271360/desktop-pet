(function(global) {
  const NUMBER_WORDS = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };

  function parseNumber(value) {
    if (!value) return null;
    if (/^\d+$/.test(value)) return Number(value);
    if (value === '半') return 30;
    if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, value)) return NUMBER_WORDS[value];

    const chars = Array.from(value);
    const tenIndex = chars.indexOf('十');
    if (tenIndex >= 0) {
      const left = chars.slice(0, tenIndex).join('');
      const right = chars.slice(tenIndex + 1).join('');
      const tens = left ? NUMBER_WORDS[left] : 1;
      const ones = right ? NUMBER_WORDS[right] : 0;
      if (typeof tens === 'number' && typeof ones === 'number') return tens * 10 + ones;
    }

    return null;
  }

  function cloneDate(date) {
    return new Date(date.getTime());
  }

  function startOfDay(date) {
    const next = cloneDate(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function add(date, amount, unit) {
    const next = cloneDate(date);
    if (unit === 'minutes') next.setMinutes(next.getMinutes() + amount);
    if (unit === 'hours') next.setHours(next.getHours() + amount);
    if (unit === 'days') next.setDate(next.getDate() + amount);
    return next;
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/[，。！？!?,]/g, ' ')
      .trim();
  }

  function isReminderRequest(text) {
    return /(提醒我|叫我|帮我.*提醒|加.*提醒|设置.*提醒|定.*提醒|创建.*提醒|记得提醒|定.*闹钟)/.test(text);
  }

  function parseRelativeTime(text, now) {
    const match = text.match(/([0-9]+|[一二两三四五六七八九十]{1,3})\s*(分钟|小时|天|日)后/);
    if (!match) return null;

    const amount = parseNumber(match[1]);
    if (!amount) return null;

    const unitMap = {
      分钟: 'minutes',
      小时: 'hours',
      天: 'days',
      日: 'days'
    };

    return {
      date: add(now, amount, unitMap[match[2]]),
      matchedText: match[0]
    };
  }

  function parseTimeOfDay(text) {
    const periodMatch = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚|夜里)?\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:点|:|：)(?:\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,3}|半)\s*(?:分)?)?/);
    if (!periodMatch) return null;

    const period = periodMatch[1] || '';
    let hour = parseNumber(periodMatch[2]);
    let minute = periodMatch[3] ? parseNumber(periodMatch[3]) : 0;
    if (hour === null || minute === null) return null;

    if ((period === '下午' || period === '晚上' || period === '今晚' || period === '夜里') && hour < 12) {
      hour += 12;
    }
    if (period === '中午' && hour < 11) {
      hour += 12;
    }
    if (hour > 23 || minute > 59) return null;

    return {
      hour,
      minute,
      matchedText: periodMatch[0]
    };
  }

  function parseDayOffset(text) {
    if (/后天/.test(text)) return { days: 2, matchedText: '后天' };
    if (/明天|明日/.test(text)) return { days: 1, matchedText: text.match(/明天|明日/)[0] };
    if (/今天|今日|今晚/.test(text)) return { days: 0, matchedText: text.match(/今天|今日|今晚/)[0] };
    return { days: 0, matchedText: '' };
  }

  function parseRecurrence(text) {
    const intervalMatch = text.match(/每隔\s*([0-9]+|[一二两三四五六七八九十]{1,3})\s*(分钟|小时|天|日)/);
    if (intervalMatch) {
      const value = parseNumber(intervalMatch[1]);
      const unitMap = {
        分钟: 'minutes',
        小时: 'hours',
        天: 'days',
        日: 'days'
      };
      if (value) {
        return {
          recurrence: {
            frequency: 'interval',
            intervalValue: value,
            intervalUnit: unitMap[intervalMatch[2]]
          },
          matchedText: intervalMatch[0]
        };
      }
    }

    if (/每天|每日/.test(text)) return { recurrence: { frequency: 'daily' }, matchedText: text.match(/每天|每日/)[0] };
    if (/每周|每星期|每礼拜/.test(text)) return { recurrence: { frequency: 'weekly' }, matchedText: text.match(/每周|每星期|每礼拜/)[0] };
    if (/每月/.test(text)) return { recurrence: { frequency: 'monthly' }, matchedText: '每月' };
    return { recurrence: { frequency: 'none' }, matchedText: '' };
  }

  function buildAbsoluteDate(text, now) {
    const time = parseTimeOfDay(text);
    if (!time) return null;

    const day = parseDayOffset(text);
    const date = startOfDay(now);
    date.setDate(date.getDate() + day.days);
    date.setHours(time.hour, time.minute, 0, 0);

    if (!day.matchedText && date.getTime() <= now.getTime()) {
      date.setDate(date.getDate() + 1);
    }

    return {
      date,
      matchedText: [day.matchedText, time.matchedText].filter(Boolean).join('')
    };
  }

  function extractTitle(text, matchedParts) {
    let title = text;
    matchedParts.filter(Boolean).forEach(part => {
      title = title.replace(part, ' ');
    });

    title = title
      .replace(/^(请|麻烦|帮我|给我|帮忙|可以)?\s*/g, '')
      .replace(/(提醒我|叫我|记得提醒我|记得|到时候)/g, ' ')
      .replace(/(加一个|添加|创建|设置|设个|定个|定|帮我|给我)?\s*(提醒事项|提醒|闹钟)?/g, ' ')
      .replace(/\b我\b/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
      .trim();

    return title || '提醒事项';
  }

  function formatReminderSummary(reminder) {
    const date = new Date(reminder.scheduledAt);
    const formatted = date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const recurrenceMap = {
      none: '',
      daily: '，每天重复',
      weekly: '，每周重复',
      monthly: '，每月重复',
      interval: `，每隔 ${reminder.recurrence.intervalValue} ${reminder.recurrence.intervalUnit === 'minutes' ? '分钟' : reminder.recurrence.intervalUnit === 'hours' ? '小时' : '天'}重复`
    };

    return `${formatted}${recurrenceMap[reminder.recurrence.frequency] || ''}`;
  }

  function parseReminderRequest(input, options = {}) {
    const text = normalizeText(input);
    const now = options.now ? new Date(options.now) : new Date();

    if (!text || !isReminderRequest(text)) {
      return { matched: false };
    }

    const recurrence = parseRecurrence(text);
    const relative = parseRelativeTime(text, now);
    const intervalStart = recurrence.recurrence.frequency === 'interval'
      ? {
          date: add(now, recurrence.recurrence.intervalValue, recurrence.recurrence.intervalUnit),
          matchedText: recurrence.matchedText
        }
      : null;
    const scheduled = relative || buildAbsoluteDate(text, now) || intervalStart;

    if (!scheduled) {
      return {
        matched: true,
        needsClarification: true,
        error: '我还缺提醒时间，比如「明天下午 3 点」或「20 分钟后」。'
      };
    }

    const title = extractTitle(text, [
      scheduled.matchedText,
      recurrence.matchedText
    ]);

    const reminder = {
      title,
      note: '',
      scheduledAt: scheduled.date.toISOString(),
      recurrence: recurrence.recurrence,
      enabled: true
    };

    return {
      matched: true,
      needsClarification: false,
      reminder,
      confirmation: `已帮你设置提醒：${title}\n时间：${formatReminderSummary(reminder)}`
    };
  }

  const api = {
    parseReminderRequest,
    isReminderRequest
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.ReminderIntent = api;
})(typeof window !== 'undefined' ? window : globalThis);
