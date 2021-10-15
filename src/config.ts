export const config = {
  app: {
    chatDir: '../_chats',
    useCookies: !true,
    cookiesPath: '../cookies/cookies.txt',
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
  logger: {
    dir: './logs',
    datePattern: 'YYMMDD',
  },
  puppeteer: {
    headless: false,
    width: 1920,
    height: 1080,
    devtools: false,
  },
  youtube: {
    channels: {
      // Nakiri Ayame Ch. 百鬼あやめ
      'UC7fk0CB07ly8oSl0aqKkqFg': {
        fromAuthorIds: [
          // El Leche
          'UC-ORlsiOfeFrWJyxqnQrxhA',
        ],
        fromAuthorNames: [],
        messageContains: ['[EN]'],
        defaultWebhookUrls: [
        ],
        membersWebhookUrls: [
        ],
      },
    },
  },
}
