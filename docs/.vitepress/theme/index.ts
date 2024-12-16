import type { Theme } from 'vitepress'
import TwoSlashFloatingVue from 'vitepress-plugin-twoslash/client'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import Home from './components/Home.vue'
import HomeContributors from './components/HomeContributors.vue'
import HomeSponsors from './components/HomeSponsors.vue'
import HomeTeam from './components/HomeTeam.vue'
import TeamMember from './components/TeamMember.vue'

import 'uno.css'

import '../../assets/styles/main.css'
import '../../assets/styles/vars.css'
import '../../assets/styles/overrides.css'

export default {
  ...DefaultTheme,

  enhanceApp(ctx: any) {
    ctx.app.component('Home', Home)
    ctx.app.component('HomeContributors', HomeContributors)
    ctx.app.component('HomeSponsors', HomeSponsors)
    ctx.app.component('HomeTeam', HomeTeam)
    ctx.app.component('TeamMember', TeamMember)
    ctx.app.use(TwoSlashFloatingVue)
  },

  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },
} satisfies Theme
