/** 应用级常量：领域规则、存储键与主题配置 */

export const MAX_LENGTH = 280;
export const MAX_AUTHOR_LENGTH = 12;
export const DEFAULT_AUTHOR = "我";

/** 动态与昵称已迁移到后端服务，本地只保留设备级 UI 偏好 */
export const STORAGE_KEYS = {
  theme: "moment.theme.v1",
  probe: "moment.probe",
};

export const THEME_MODES = ["system", "light", "dark"];

export const THEME_LABELS = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色",
};
