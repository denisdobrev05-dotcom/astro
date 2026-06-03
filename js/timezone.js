/* timezone.js — часова зона на България (EET = UTC+2, EEST = UTC+3 през лятото).
 * Лятното часово време следва правилото на ЕС: от последната неделя на март (03:00)
 * до последната неделя на октомври (04:00). */
const BgTime = (function () {
  "use strict";

  function lastSunday(year, month) {
    // month: 0-базиран (2 = март, 9 = октомври)
    const d = new Date(Date.UTC(year, month + 1, 0)); // последен ден от месеца
    const day = d.getUTCDate();
    const dow = d.getUTCDay();
    return day - dow; // дата на последната неделя
  }

  // Връща часовата разлика (часове) спрямо UTC за дадено местно българско време.
  function offsetForLocal(year, month, day, hour) {
    // month 1-базиран на входа
    if (year < 1980) return 2; // преди въвеждането на сегашния режим — приближение
    const marSun = lastSunday(year, 2);
    const octSun = lastSunday(year, 9);
    // Преобразуваме в сравнимо число: месец*100+ден (часовете в преходните дни са рядкост)
    const cur = month * 100 + day;
    const start = 3 * 100 + marSun;
    const end = 10 * 100 + octSun;
    const inDst = cur > start && cur < end ? true :
      cur === start ? hour >= 3 :
        cur === end ? hour < 4 :
          (cur > start && cur < end);
    return inDst ? 3 : 2;
  }

  // Преобразува местно българско време в UTC компоненти.
  function toUTC(year, month, day, hour, minute, manualOffset) {
    const off = (manualOffset === "auto" || manualOffset == null)
      ? offsetForLocal(year, month, day, hour)
      : Number(manualOffset);
    const local = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const utc = new Date(local.getTime() - off * 3600 * 1000);
    return {
      year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate(),
      hour: utc.getUTCHours(), minute: utc.getUTCMinutes(), offset: off,
    };
  }

  return { toUTC, offsetForLocal };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BgTime;
