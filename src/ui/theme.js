// Design tokens สำหรับ Diagram+
// TODO: ค่าสี Navy/Gold ด้านล่างเป็น placeholder ชั่วคราว
// ต้องเปลี่ยนเป็นค่า hex จริงจากโปรเจกต์ AUDIT+ ก่อนขึ้นใช้งานจริง (ดู docs/PLAN.md ข้อ 2, 5)

export const colors = {
  navy: {
    50: '#eef2f7',
    100: '#d3dde8',
    300: '#5c7a9e',
    500: '#0a2a4a',
    700: '#071d33',
    900: '#040f1c',
  },
  gold: {
    100: '#f6e9c4',
    300: '#e0bf6a',
    500: '#c9a227',
    700: '#96791d',
  },
  neutral: {
    white: '#ffffff',
    black: '#111111',
    gray100: '#f5f5f5',
    gray300: '#d9d9d9',
    gray500: '#8a8a8a',
    gray700: '#4a4a4a',
  },
};

export const fonts = {
  body: "'Sarabun', 'Noto Sans Thai', sans-serif",
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

// ธีมพิมพ์ (พื้นขาว — ธีมหลัก) และธีมจอ (พื้นเข้ม สำหรับโปรเจกเตอร์)
// accentContrast = สีตัวอักษรที่อ่านออกเมื่อวางบนพื้นสี accent (gold อ่อน→ตัวเข้ม, gold เข้ม→ตัวขาว)
export const themes = {
  print: {
    background: colors.neutral.white,
    surface: colors.neutral.gray100,
    text: colors.navy[900],
    accent: colors.gold[700],
    accentContrast: colors.neutral.white,
    line: colors.neutral.gray500,
  },
  screen: {
    background: colors.navy[900],
    surface: colors.navy[700],
    text: colors.neutral.white,
    accent: colors.gold[500],
    accentContrast: colors.neutral.black,
    line: colors.navy[300],
  },
};

export const DEFAULT_THEME_MODE = 'print';

export function applyTheme(mode) {
  const theme = themes[mode] ?? themes[DEFAULT_THEME_MODE];
  const root = document.documentElement;
  root.style.setProperty('--color-background', theme.background);
  root.style.setProperty('--color-surface', theme.surface);
  root.style.setProperty('--color-text', theme.text);
  root.style.setProperty('--color-accent', theme.accent);
  root.style.setProperty('--color-accent-contrast', theme.accentContrast);
  root.style.setProperty('--color-line', theme.line);
  root.style.setProperty('--font-body', fonts.body);
  root.dataset.theme = mode;
}
