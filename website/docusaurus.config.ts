import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'GridPane Alerts Archive',
  tagline: 'A searchable local archive of GridPane notification-centre alerts.',
  url: 'https://managingwp.github.io',
  baseUrl: '/gridpane-alerts-extension/',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  favicon: 'img/favicon.ico',

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          exclude: [
            '**/_*.{js,jsx,ts,tsx,md,mdx}',
            '**/_*/**',
            '**/*.test.{js,jsx,ts,tsx}',
            '**/__tests__/**',
            // Publish source for the canonical policy URL; never a site page.
            'PRIVACY.md',
          ],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        indexBlog: false,
        docsRouteBasePath: '/',
        // The content lives outside the site directory.
        docsDir: ['../docs'],
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'GridPane Alerts Archive',
      items: [
        {type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs'},
        {
          href: 'https://github.com/managingwp/gridpane-alerts-extension',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting started', to: '/getting-started/installation'},
            {
              label: 'Privacy policy',
              href: 'https://managingwp.io/policies/#gridpane-alerts-archive',
            },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'GitHub repository',
              href: 'https://github.com/managingwp/gridpane-alerts-extension',
            },
            {
              label: 'Releases',
              href: 'https://github.com/managingwp/gridpane-alerts-extension/releases',
            },
          ],
        },
      ],
      copyright: `GridPane Alerts Archive — an unofficial extension. Not affiliated with GridPane.`,
    },
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
