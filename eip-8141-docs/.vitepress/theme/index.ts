import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import HomeBoxes from './HomeBoxes.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-before': () => h(HomeBoxes),
    })
  },
}
