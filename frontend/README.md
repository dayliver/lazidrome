# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Temporary Code for Reset Local DB

```
(async () => {
  try {
    const dir = await navigator.storage.getDirectory();
    await dir.removeEntry('navidrome-db.sqlite');
    console.log('✅ 로컬 DB 파일 삭제 완료! 새로고침 후 다시 동기화해주세요.');
  } catch(e) {}
})();
```
