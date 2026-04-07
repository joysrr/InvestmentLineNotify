export function useTelegram() {
  const tg = window.Telegram?.WebApp

  return {
    tg,
    initData: tg?.initData ?? '',
    themeParams: tg?.themeParams ?? {},
    expand: () => tg?.expand(),
    openLink: (url) => {
      if (tg) {
        tg.openLink(url)
      } else {
        window.open(url, '_blank')
      }
    }
  }
}
