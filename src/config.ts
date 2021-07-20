export const config = {
  app: {
    logDir: '../_logs',
    chatDir: '../_chats',
    useCookies: !true,
    cookiePath: '../cookies/cookies.txt',
  },
  puppeteer: {
    headless: false,
    width: 1920,
    height: 1080,
    devtools: false,
  },
}
