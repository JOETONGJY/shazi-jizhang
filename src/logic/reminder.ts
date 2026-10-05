import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** 每日定时记账提醒（本地通知，无推送服务器） */
export async function setDailyReminder(enabled: boolean, hour = 21, minute = 0): Promise<{ ok: boolean; msg: string }> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return { ok: true, msg: '已关闭提醒' };
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return { ok: false, msg: '未获得通知权限，请在系统设置中开启' };
    await Notifications.scheduleNotificationAsync({
      content: { title: '记账提醒', body: '今天记完账了吗？花一分钟把今天的账记一下 📒' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
    return { ok: true, msg: `已开启，每天 ${hour}:${minute < 10 ? '0' + minute : minute} 提醒` };
  } catch (e) {
    return { ok: false, msg: `设置失败：${String(e)}` };
  }
}
