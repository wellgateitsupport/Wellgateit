import js from '@eslint/js';
import react from 'eslint-plugin-react';
import globals from 'globals';

// จุดประสงค์หลักของ config นี้: ตรวจ no-undef + react/jsx-no-undef
// หลังแยกโค้ดจากไฟล์เดียวเป็นโมดูล — import ที่ขาดต้องโดนจับที่นี่
// rules สไตล์ทั้งหมดถูกปิดเพื่อให้ผลลัพธ์เป็น binary (มี undefined หรือไม่มี)
export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser }
    },
    settings: { react: { version: '18.3' } },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
      'no-control-regex': 'off',
      'no-console': 'off',
      'no-irregular-whitespace': 'off',
      'no-cond-assign': 'off',
      'no-fallthrough': 'off',
      'no-case-declarations': 'off',
      'no-inner-declarations': 'off',
      'no-async-promise-executor': 'off',
      'no-misleading-character-class': 'off',
      // ไฟล์ต้นฉบับมี key ซ้ำใน ICON_PATHS (download, zap) — พฤติกรรม JS คือ key หลังชนะ
      // เหมือนกันทั้งต้นฉบับและเวอร์ชันโมดูล จึงคงไว้ตาม parity (ห้ามแก้เนื้อโค้ดที่สกัดมา)
      'no-dupe-keys': 'off'
    }
  }
];
