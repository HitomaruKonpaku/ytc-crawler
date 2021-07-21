export const config = {
  app: {
    logDir: '../_logs',
    chatDir: '../_chats',
    useCookies: !true,
    cookiePath: '../cookies/cookies.txt',
    request: {
      blockUrls: [
        'doubleclick.net',
        '/pagead',
        '/log_event',
        '/ptracking',
        '/api/stats/qoe',
        '/api/stats/atr',
      ],
    },
    response: {},
  },
  puppeteer: {
    headless: false,
    width: 1920,
    height: 1080,
    devtools: false,
  },
}
