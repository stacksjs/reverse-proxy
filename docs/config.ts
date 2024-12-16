import type { DocsConfig } from '@stacksjs/types'
import type { HeadConfig } from 'vitepress'
import { SocialLinkIcon } from '@stacksjs/types'
import analytics from './analytic'

export const faviconHead: HeadConfig[] = [
  [
    'link',
    {
      rel: 'icon',
      href: 'https://raw.githubusercontent.com/stacksjs/stacks/main/public/logo-transparent.svg?https://raw.githubusercontent.com/stacksjs/stacks/main/public/logo-transparent.svg?asdas',
    },
  ],
]

export const googleAnalyticsHead: HeadConfig[] = [
  [
    'script',
    {
      async: '',
      src: `https://www.googletagmanager.com/gtag/js?id=${analytics.drivers?.googleAnalytics?.trackingId}`,
    },
  ],
  [
    'script',
    {},
    `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'TAG_ID');`,
  ],
]

export const fathomAnalyticsHead: HeadConfig[] = [
  [
    'script',
    {
      'src': 'https://cdn.usefathom.com/script.js',
      'data-site': analytics.drivers?.fathom?.siteId || '',
      'defer': '',
    },
  ],
]

export const analyticsHead
  = analytics.driver === 'fathom'
    ? fathomAnalyticsHead
    : analytics.driver === 'google-analytics'
      ? googleAnalyticsHead
      : []

const nav = [
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md',
  },
  // { text: 'Blog', link: 'https://updates.ow3.org' },
  {
    text: 'Resources',
    items: [
      { text: 'Team', link: '/team' },
      { text: 'Sponsors', link: '/sponsors' },
      { text: 'Partners', link: '/partners' },
      { text: 'Postcardware', link: '/postcardware' },
      {
        items: [
          {
            text: 'Awesome Stacks',
            link: 'https://github.com/stacksjs/awesome-stacks',
          },
          {
            text: 'Contributing',
            link: 'https://github.com/stacksjs/stacks/blob/main/.github/CONTRIBUTING.md',
          },
        ],
      },
    ],
  },
]

const sidebar = [
  {
    text: 'Get Started',
    items: [
      { text: 'Introduction', link: '/intro' },
      { text: 'Install', link: '/install' },
    ],
  },
]

/**
 * **Documentation Options**
 *
 * This configuration defines all of your documentation options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  lang: 'en-US',
  title: 'Stacks',
  description: 'Rapid application, cloud & library development framework.',
  lastUpdated: true,
  deploy: true,
  base: '/',

  metaChunk: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/assets/images/logos/logo-mini' }],
    ['link', { rel: 'icon', type: 'image/png', href: './assets/images/logos/logo.png' }],
    ['meta', { name: 'theme-color', content: '#1e40af' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:title', content: 'Stacks | A better developer environment.' }],
    ['meta', { property: 'og:site_name', content: 'Stacks' }],
    ['meta', { property: 'og:image', content: 'https://stacksjs.org/images/og-image.png' }],
    ['meta', { property: 'og:url', content: 'https://stacksjs.org/' }],
    // ['script', { 'src': 'https://cdn.usefathom.com/script.js', 'data-site': '', 'data-spa': 'auto', 'defer': '' }],
    ...analyticsHead,
  ],

  themeConfig: {
    logo: './assets/images/logos/logo-transparent.svg',

    nav,
    sidebar,

    editLink: {
      pattern: 'https://github.com/stacksjs/stacks/edit/main/docs/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Stacks.js, Inc.',
    },

    socialLinks: [
      { icon: SocialLinkIcon.Twitter, link: 'https://twitter.com/stacksjs' },
      { icon: SocialLinkIcon.Bluesky, link: 'https://bsky.app/profile/chrisbreuer.dev' },
      { icon: SocialLinkIcon.GitHub, link: 'https://github.com/stacksjs/stacks' },
      { icon: SocialLinkIcon.Discord, link: 'https://discord.gg/stacksjs' },
    ],

    // algolia: services.algolia,

    // carbonAds: {
    //   code: '',
    //   placement: '',
    // },
  },
} satisfies DocsConfig
