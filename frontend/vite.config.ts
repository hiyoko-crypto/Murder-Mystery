import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 明示的に 127.0.0.1 を指定する — "localhost" は ::1 にも解決され、
      // このマシンでは別の何か（WSL/Docker関連らしき最小サービス）が
      // [::1]:8000 を掴んでいて、そちらに転送されると本物のAPIが404になる。
      '/health':          'http://127.0.0.1:8000',
      // 正規表現で「/scenario」ちょうどだけを転送する。前方一致だと画面の
      // URL「/scenario-select」まで転送され、再読み込みで404になっていた。
      '^/scenario($|\\?)': 'http://127.0.0.1:8000',
      '/scenarios':       'http://127.0.0.1:8000',
      '/select_scenario': 'http://127.0.0.1:8000',
      '/chat':            'http://127.0.0.1:8000',
      '/state':           'http://127.0.0.1:8000',
      '/briefing':        'http://127.0.0.1:8000',
      '/examine':         'http://127.0.0.1:8000',
      '/indict':          'http://127.0.0.1:8000',
      '/reset':           'http://127.0.0.1:8000',
    },
  },
})
